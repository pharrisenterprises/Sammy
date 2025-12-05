/**
 * EditProjectModal - Modal for editing existing projects
 * @module components/Dashboard/EditProjectModal
 * @version 1.0.0
 * 
 * Provides a modal form for editing projects:
 * - All fields from CreateProjectDialog
 * - Status field (draft, testing, complete)
 * - Project metadata display (ID, dates)
 * - Dirty checking with unsaved changes warning
 * - Change tracking
 * 
 * @example
 * ```tsx
 * <EditProjectModal
 *   isOpen={showModal}
 *   project={selectedProject}
 *   onClose={() => setShowModal(false)}
 *   onSave={(data) => handleSave(data)}
 * />
 * ```
 */

import React, { useState, useCallback, useEffect, useRef, useMemo, memo } from 'react';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Project status
 */
export type ProjectStatus = 'draft' | 'testing' | 'complete';

/**
 * Project data for editing
 */
export interface Project {
  id: number;
  name: string;
  description?: string;
  target_url: string;
  status: ProjectStatus;
  created_date: number;
  updated_date: number;
  recorded_steps?: unknown[];
  parsed_fields?: unknown[];
  csv_data?: unknown[];
}

/**
 * Edit project data (fields that can be edited)
 */
export interface EditProjectData {
  name: string;
  description: string;
  target_url: string;
  status: ProjectStatus;
}

/**
 * Form field errors
 */
export interface FormErrors {
  name?: string;
  description?: string;
  target_url?: string;
  status?: string;
}

/**
 * Component props
 */
export interface EditProjectModalProps {
  isOpen: boolean;
  project: Project | null;
  onClose: () => void;
  onSave: (id: number, data: EditProjectData) => Promise<void> | void;
  isLoading?: boolean;
  testId?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const URL_PATTERN = /^https?:\/\/.+/i;

const STATUS_OPTIONS: { value: ProjectStatus; label: string; description: string }[] = [
  { value: 'draft', label: 'Draft', description: 'Project is being set up' },
  { value: 'testing', label: 'Testing', description: 'Active testing in progress' },
  { value: 'complete', label: 'Complete', description: 'Testing completed' },
];

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
export function validateFormData(data: EditProjectData): FormErrors {
  const errors: FormErrors = {};

  if (!data.name.trim()) {
    errors.name = VALIDATION_MESSAGES.nameRequired;
  } else if (data.name.length > 100) {
    errors.name = VALIDATION_MESSAGES.nameMaxLength;
  }

  if (data.description.length > 500) {
    errors.description = VALIDATION_MESSAGES.descriptionMaxLength;
  }

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

/**
 * Check if data has changed from original
 */
export function hasChanges(original: EditProjectData, current: EditProjectData): boolean {
  return (
    original.name !== current.name ||
    original.description !== current.description ||
    original.target_url !== current.target_url ||
    original.status !== current.status
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format date for display
 */
export function formatDate(timestamp: number): string {
  if (!timestamp) return 'N/A';
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get project data from project
 */
function getProjectData(project: Project): EditProjectData {
  return {
    name: project.name,
    description: project.description ?? '',
    target_url: project.target_url,
    status: project.status,
  };
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
    <label htmlFor={id} className="block text-sm font-medium text-gray-700">
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
  type?: 'text' | 'url';
  testId?: string;
}> = memo(({ id, value, onChange, placeholder, error = false, disabled = false, type = 'text', testId }) => (
  <input
    id={id}
    type={type}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    disabled={disabled}
    className={`
      w-full px-3 py-2 rounded-md border shadow-sm text-sm
      focus:outline-none focus:ring-2 focus:ring-offset-0
      disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
      ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}
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
}> = memo(({ id, value, onChange, placeholder, error = false, disabled = false, rows = 3, testId }) => (
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
      ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}
    `}
    aria-invalid={error}
    data-testid={testId ?? id}
  />
));

TextArea.displayName = 'TextArea';

/**
 * Status select component
 */
const StatusSelect: React.FC<{
  value: ProjectStatus;
  onChange: (value: ProjectStatus) => void;
  disabled?: boolean;
  testId?: string;
}> = memo(({ value, onChange, disabled = false, testId }) => (
  <div className="space-y-2">
    {STATUS_OPTIONS.map((option) => (
      <label
        key={option.value}
        className={`
          flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors
          ${value === option.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input
          type="radio"
          name="status"
          value={option.value}
          checked={value === option.value}
          onChange={(e) => onChange(e.target.value as ProjectStatus)}
          disabled={disabled}
          className="mt-0.5 h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
          data-testid={testId ? `${testId}-${option.value}` : undefined}
        />
        <div>
          <span className="block text-sm font-medium text-gray-900">{option.label}</span>
          <span className="block text-xs text-gray-500">{option.description}</span>
        </div>
      </label>
    ))}
  </div>
));

StatusSelect.displayName = 'StatusSelect';

/**
 * Metadata display component
 */
const MetadataItem: React.FC<{
  label: string;
  value: string | number;
}> = memo(({ label, value }) => (
  <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
    <span className="text-sm text-gray-500">{label}</span>
    <span className="text-sm font-medium text-gray-900">{value}</span>
  </div>
));

MetadataItem.displayName = 'MetadataItem';

/**
 * Unsaved changes warning component
 */
const UnsavedChangesWarning: React.FC<{
  onDiscard: () => void;
  onCancel: () => void;
  testId?: string;
}> = memo(({ onDiscard, onCancel, testId }) => (
  <div
    className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
    data-testid={testId}
  >
    <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 p-6">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 p-2 bg-yellow-100 rounded-full">
          <Icons.Warning />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Unsaved Changes</h3>
          <p className="mt-1 text-sm text-gray-500">
            You have unsaved changes. Are you sure you want to discard them?
          </p>
        </div>
      </div>
      <div className="mt-6 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          data-testid={`${testId}-cancel`}
        >
          Keep Editing
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
          data-testid={`${testId}-discard`}
        >
          Discard Changes
        </button>
      </div>
    </div>
  </div>
));

UnsavedChangesWarning.displayName = 'UnsavedChangesWarning';

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
  Edit: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  Warning: () => (
    <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * EditProjectModal component
 */
export const EditProjectModal: React.FC<EditProjectModalProps> = memo(({
  isOpen,
  project,
  onClose,
  onSave,
  isLoading: externalLoading = false,
  testId = 'edit-project-modal',
}) => {
  // Form state
  const [formData, setFormData] = useState<EditProjectData>({
    name: '',
    description: '',
    target_url: '',
    status: 'draft',
  });
  const [originalData, setOriginalData] = useState<EditProjectData | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);

  // Refs
  const dialogRef = useRef<HTMLDivElement>(null);

  // Combined loading state
  const isLoading = externalLoading || isSubmitting;

  // Check for dirty state
  const isDirty = useMemo(() => {
    if (!originalData) return false;
    return hasChanges(originalData, formData);
  }, [originalData, formData]);

  // Handle close with dirty checking
  const handleClose = useCallback(() => {
    if (isDirty) {
      setShowUnsavedWarning(true);
    } else {
      onClose();
    }
  }, [isDirty, onClose]);

  // Initialize form when project changes
  useEffect(() => {
    if (isOpen && project) {
      const data = getProjectData(project);
      setFormData(data);
      setOriginalData(data);
      setErrors({});
      setTouched({});
      setShowUnsavedWarning(false);
    }
  }, [isOpen, project]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading && !showUnsavedWarning) {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, showUnsavedWarning, handleClose]);

  // Handle discard changes
  const handleDiscard = useCallback(() => {
    setShowUnsavedWarning(false);
    onClose();
  }, [onClose]);

  // Handle keep editing
  const handleKeepEditing = useCallback(() => {
    setShowUnsavedWarning(false);
  }, []);

  // Update field value
  const updateField = useCallback(<K extends keyof EditProjectData>(
    field: K,
    value: EditProjectData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  }, [errors]);

  // Mark field as touched
  const touchField = useCallback((field: keyof EditProjectData) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!project) return;

    const validationErrors = validateFormData(formData);
    setErrors(validationErrors);
    setTouched({ name: true, description: true, target_url: true, status: true });

    if (hasErrors(validationErrors)) {
      return;
    }

    setIsSubmitting(true);

    try {
      await onSave(project.id, {
        name: formData.name.trim(),
        description: formData.description.trim(),
        target_url: formData.target_url.trim(),
        status: formData.status,
      });
      onClose();
    } catch (err) {
      console.error('Failed to save project:', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [project, formData, onSave, onClose]);

  // Don't render if not open or no project
  if (!isOpen || !project) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        data-testid={testId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${testId}-title`}
      >
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 transition-opacity"
          aria-hidden="true"
          onClick={handleClose}
        />

        {/* Dialog */}
        <div
          ref={dialogRef}
          className="relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Icons.Edit />
              </div>
              <div>
                <h2 id={`${testId}-title`} className="text-lg font-semibold text-gray-900">
                  Edit Project
                </h2>
                {isDirty && (
                  <span className="text-xs text-amber-600">Unsaved changes</span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-md transition-colors disabled:opacity-50"
              aria-label="Close dialog"
              data-testid={`${testId}-close`}
            >
              <Icons.Close />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Project Metadata */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Project Information</h3>
                <MetadataItem label="Project ID" value={`#${project.id}`} />
                <MetadataItem label="Created" value={formatDate(project.created_date)} />
                <MetadataItem label="Last Updated" value={formatDate(project.updated_date)} />
                <MetadataItem label="Steps Recorded" value={project.recorded_steps?.length ?? 0} />
              </div>

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
              </FormField>

              {/* Status Field */}
              <FormField id="project-status" label="Status">
                <StatusSelect
                  value={formData.status}
                  onChange={(value) => updateField('status', value)}
                  disabled={isLoading}
                  testId={`${testId}-status`}
                />
              </FormField>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
              <button
                type="button"
                onClick={handleClose}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                data-testid={`${testId}-cancel`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || !isDirty}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                data-testid={`${testId}-submit`}
              >
                {isLoading && <Icons.Spinner />}
                {isLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Unsaved Changes Warning */}
      {showUnsavedWarning && (
        <UnsavedChangesWarning
          onDiscard={handleDiscard}
          onCancel={handleKeepEditing}
          testId={`${testId}-unsaved-warning`}
        />
      )}
    </>
  );
});

EditProjectModal.displayName = 'EditProjectModal';

// ============================================================================
// EXPORTS
// ============================================================================

export default EditProjectModal;
