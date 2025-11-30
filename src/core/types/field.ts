/**
 * @fileoverview Field type definitions for CSV-to-Step mapping
 * @module core/types/field
 * @version 1.0.0
 * 
 * This module defines the canonical Field interface for mapping CSV columns
 * to recorded input steps for data-driven testing.
 * 
 * CRITICAL: Property names use snake_case (field_name, inputvarfields)
 * This matches the existing codebase convention.
 * 
 * @see PHASE_4_SPECIFICATIONS.md Section 1.3 for authoritative specification
 * @see csv-processing_breakdown.md for auto-mapping logic
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Threshold for auto-mapping fuzzy string matching
 * 
 * CRITICAL: This is 0.3 (30%), NOT 0.8 (80%)
 * 
 * A lower threshold catches more potential matches for user review.
 * The string-similarity library's compareTwoStrings() returns 0-1.
 */
export const AUTO_MAP_THRESHOLD = 0.3;

/**
 * Minimum field name length for auto-mapping consideration
 */
export const MIN_FIELD_NAME_LENGTH = 1;

/**
 * Maximum field name length (for validation)
 */
export const MAX_FIELD_NAME_LENGTH = 255;

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * CSV column to step mapping for data-driven testing
 * 
 * A Field represents the relationship between a CSV column header
 * and a recorded input step. During test execution, the CSV value
 * replaces the step's recorded value.
 * 
 * CRITICAL: Property names are snake_case to match existing codebase:
 * - field_name (NOT fieldName or name)
 * - inputvarfields (NOT inputVarFields or targetLabel)
 * 
 * @example
 * ```typescript
 * // CSV header "username" mapped to step with label "Username Field"
 * const field: Field = {
 *   field_name: 'username',
 *   mapped: true,
 *   inputvarfields: 'Username Field'
 * };
 * 
 * // Unmapped CSV header
 * const unmappedField: Field = {
 *   field_name: 'unused_column',
 *   mapped: false,
 *   inputvarfields: ''
 * };
 * ```
 */
export interface Field {
  /**
   * CSV column header name (exact match, case-sensitive)
   * 
   * This is the first row value from the CSV file.
   * Must match exactly when looking up values during replay.
   */
  field_name: string;

  /**
   * Whether this CSV column is mapped to a step
   * 
   * - true: Column is mapped, inputvarfields contains target step label
   * - false: Column is not mapped, will be ignored during replay
   */
  mapped: boolean;

  /**
   * Label of the target step this field maps to
   * 
   * Must match a Step.label value from recorded_steps when mapped=true.
   * Empty string when mapped=false.
   */
  inputvarfields: string;
}

/**
 * Field with guaranteed mapping (for type narrowing)
 */
export interface MappedField extends Field {
  mapped: true;
  inputvarfields: string; // Non-empty when mapped
}

/**
 * Field without mapping
 */
export interface UnmappedField extends Field {
  mapped: false;
  inputvarfields: '';
}

/**
 * Input for creating a new field mapping
 */
export interface CreateFieldInput {
  field_name: string;
  mapped?: boolean;
  inputvarfields?: string;
}

/**
 * Input for updating a field mapping
 */
export interface UpdateFieldInput {
  field_name: string;
  mapped?: boolean;
  inputvarfields?: string;
}

/**
 * Result of auto-mapping operation
 */
export interface AutoMapResult {
  field_name: string;
  suggested_target: string | null;
  confidence: number;
  auto_mapped: boolean;
}

/**
 * Statistics about field mappings
 */
export interface FieldMappingStats {
  total_fields: number;
  mapped_count: number;
  unmapped_count: number;
  mapping_percentage: number;
}

/**
 * Field display info for UI
 */
export interface FieldDisplayInfo {
  field_name: string;
  mapped: boolean;
  target_label: string;
  available_targets: string[];
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard to validate Field object structure
 * 
 * @param value - Value to check
 * @returns True if value conforms to Field interface
 * 
 * @example
 * ```typescript
 * const data = parseFieldFromAPI(response);
 * if (isField(data)) {
 *   console.log(data.field_name); // Type-safe access
 * }
 * ```
 */
export function isField(value: unknown): value is Field {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // Required fields with correct types
  if (typeof obj.field_name !== 'string') return false;
  if (typeof obj.mapped !== 'boolean') return false;
  if (typeof obj.inputvarfields !== 'string') return false;

  return true;
}

/**
 * Type guard to check if field is mapped
 * 
 * @param field - Field to check
 * @returns True if field is mapped to a step
 */
export function isMappedField(field: Field): field is MappedField {
  return field.mapped === true && field.inputvarfields.length > 0;
}

/**
 * Type guard to check if field is unmapped
 * 
 * @param field - Field to check
 * @returns True if field is not mapped
 */
export function isUnmappedField(field: Field): field is UnmappedField {
  return field.mapped === false;
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a new unmapped field from CSV column header
 * 
 * @param fieldName - CSV column header name
 * @returns Unmapped field object
 * 
 * @example
 * ```typescript
 * const headers = ['username', 'password', 'email'];
 * const fields = headers.map(createUnmappedField);
 * // All fields start unmapped, ready for manual or auto mapping
 * ```
 */
export function createUnmappedField(fieldName: string): UnmappedField {
  return {
    field_name: fieldName.trim(),
    mapped: false,
    inputvarfields: ''
  };
}

/**
 * Create a mapped field linking CSV column to step label
 * 
 * @param fieldName - CSV column header name
 * @param targetLabel - Step label to map to
 * @returns Mapped field object
 * 
 * @example
 * ```typescript
 * const field = createMappedField('user_email', 'Email Address');
 * // field.mapped === true
 * // field.inputvarfields === 'Email Address'
 * ```
 */
export function createMappedField(fieldName: string, targetLabel: string): MappedField {
  return {
    field_name: fieldName.trim(),
    mapped: true,
    inputvarfields: targetLabel.trim()
  };
}

/**
 * Create a field from input, with sensible defaults
 * 
 * @param input - Field creation input
 * @returns Field object
 */
export function createField(input: CreateFieldInput): Field {
  const fieldName = input.field_name.trim();
  const mapped = input.mapped ?? false;
  const inputvarfields = input.inputvarfields?.trim() ?? '';

  // Ensure consistency: if mapped is true, inputvarfields should have value
  // If mapped is false, inputvarfields should be empty
  if (mapped && inputvarfields.length > 0) {
    return {
      field_name: fieldName,
      mapped: true,
      inputvarfields
    };
  }

  return {
    field_name: fieldName,
    mapped: false,
    inputvarfields: ''
  };
}

/**
 * Create fields from CSV headers (all unmapped initially)
 * 
 * @param headers - Array of CSV column headers
 * @returns Array of unmapped fields
 */
export function createFieldsFromHeaders(headers: string[]): Field[] {
  return headers
    .filter(header => header && header.trim().length > 0)
    .map(header => createUnmappedField(header));
}

// ============================================================================
// MAPPING FUNCTIONS
// ============================================================================

/**
 * Map a field to a target step label
 * 
 * @param field - Field to map
 * @param targetLabel - Step label to map to
 * @returns New mapped field (immutable)
 */
export function mapField(field: Field, targetLabel: string): MappedField {
  return {
    field_name: field.field_name,
    mapped: true,
    inputvarfields: targetLabel.trim()
  };
}

/**
 * Unmap a field (remove mapping)
 * 
 * @param field - Field to unmap
 * @returns New unmapped field (immutable)
 */
export function unmapField(field: Field): UnmappedField {
  return {
    field_name: field.field_name,
    mapped: false,
    inputvarfields: ''
  };
}

/**
 * Toggle field mapping
 * 
 * @param field - Field to toggle
 * @param targetLabel - Target label if mapping (ignored if unmapping)
 * @returns New field with toggled mapping
 */
export function toggleFieldMapping(field: Field, targetLabel?: string): Field {
  if (field.mapped) {
    return unmapField(field);
  }
  
  if (targetLabel && targetLabel.trim().length > 0) {
    return mapField(field, targetLabel);
  }
  
  return field;
}

/**
 * Update field in array immutably
 * 
 * @param fields - Original fields array
 * @param fieldName - Name of field to update
 * @param updates - Fields to update
 * @returns New array with updated field
 */
export function updateFieldInArray(
  fields: Field[],
  fieldName: string,
  updates: Partial<Omit<Field, 'field_name'>>
): Field[] {
  return fields.map(field => {
    if (field.field_name !== fieldName) {
      return field;
    }

    const updated = { ...field, ...updates };
    
    // Ensure consistency
    if (updated.mapped && (!updated.inputvarfields || updated.inputvarfields.length === 0)) {
      return { ...updated, mapped: false, inputvarfields: '' };
    }
    
    if (!updated.mapped) {
      return { ...updated, inputvarfields: '' };
    }
    
    return updated;
  });
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * Get all mapped fields
 * 
 * @param fields - Array of fields
 * @returns Array of mapped fields only
 */
export function getMappedFields(fields: Field[]): MappedField[] {
  return fields.filter(isMappedField);
}

/**
 * Get all unmapped fields
 * 
 * @param fields - Array of fields
 * @returns Array of unmapped fields only
 */
export function getUnmappedFields(fields: Field[]): UnmappedField[] {
  return fields.filter(isUnmappedField);
}

/**
 * Find field by name
 * 
 * @param fields - Array of fields
 * @param fieldName - Name to search for
 * @returns Field if found, undefined otherwise
 */
export function getFieldByName(fields: Field[], fieldName: string): Field | undefined {
  return fields.find(field => field.field_name === fieldName);
}

/**
 * Find field by target label
 * 
 * @param fields - Array of fields
 * @param targetLabel - Target label to search for
 * @returns Field if found, undefined otherwise
 */
export function getFieldByTarget(fields: Field[], targetLabel: string): Field | undefined {
  return fields.find(field => 
    field.mapped && field.inputvarfields === targetLabel
  );
}

/**
 * Check if a target label is already mapped
 * 
 * @param fields - Array of fields
 * @param targetLabel - Target label to check
 * @returns True if target is already mapped
 */
export function isTargetMapped(fields: Field[], targetLabel: string): boolean {
  return fields.some(field => 
    field.mapped && field.inputvarfields === targetLabel
  );
}

/**
 * Get list of unmapped target labels
 * 
 * @param fields - Current field mappings
 * @param allTargets - All available target labels (from steps)
 * @returns Array of targets not yet mapped
 */
export function getAvailableTargets(fields: Field[], allTargets: string[]): string[] {
  const mappedTargets = new Set(
    fields
      .filter(f => f.mapped)
      .map(f => f.inputvarfields)
  );
  
  return allTargets.filter(target => !mappedTargets.has(target));
}

// ============================================================================
// STATISTICS FUNCTIONS
// ============================================================================

/**
 * Calculate field mapping statistics
 * 
 * @param fields - Array of fields
 * @returns Mapping statistics
 */
export function getFieldMappingStats(fields: Field[]): FieldMappingStats {
  const total = fields.length;
  const mapped = fields.filter(f => f.mapped).length;
  const unmapped = total - mapped;
  const percentage = total > 0 ? Math.round((mapped / total) * 100) : 0;

  return {
    total_fields: total,
    mapped_count: mapped,
    unmapped_count: unmapped,
    mapping_percentage: percentage
  };
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validation error for field data
 */
export interface FieldValidationError {
  field: keyof Field | 'general';
  message: string;
}

/**
 * Validate field data
 * 
 * @param field - Field data to validate
 * @returns Array of validation errors (empty if valid)
 */
export function validateField(field: Partial<Field>): FieldValidationError[] {
  const errors: FieldValidationError[] = [];

  // field_name validation
  if (!field.field_name || field.field_name.trim().length === 0) {
    errors.push({ field: 'field_name', message: 'Field name is required' });
  } else if (field.field_name.length > MAX_FIELD_NAME_LENGTH) {
    errors.push({ 
      field: 'field_name', 
      message: `Field name must be ${MAX_FIELD_NAME_LENGTH} characters or less` 
    });
  }

  // mapped validation
  if (field.mapped !== undefined && typeof field.mapped !== 'boolean') {
    errors.push({ field: 'mapped', message: 'Mapped must be a boolean' });
  }

  // inputvarfields validation
  if (field.mapped === true) {
    if (!field.inputvarfields || field.inputvarfields.trim().length === 0) {
      errors.push({ 
        field: 'inputvarfields', 
        message: 'Target step label is required when field is mapped' 
      });
    }
  }

  // Consistency check
  if (field.mapped === false && field.inputvarfields && field.inputvarfields.length > 0) {
    errors.push({ 
      field: 'general', 
      message: 'Unmapped field should not have a target label' 
    });
  }

  return errors;
}

/**
 * Check if field data is valid
 * 
 * @param field - Field data to validate
 * @returns True if field is valid
 */
export function isValidField(field: Partial<Field>): boolean {
  return validateField(field).length === 0;
}

/**
 * Validate array of fields for duplicates and consistency
 * 
 * @param fields - Array of fields to validate
 * @returns Array of validation errors
 */
export function validateFieldArray(fields: Field[]): FieldValidationError[] {
  const errors: FieldValidationError[] = [];

  // Check for duplicate field names
  const fieldNames = new Set<string>();
  for (const field of fields) {
    if (fieldNames.has(field.field_name)) {
      errors.push({ 
        field: 'field_name', 
        message: `Duplicate field name: ${field.field_name}` 
      });
    }
    fieldNames.add(field.field_name);
  }

  // Check for duplicate target mappings
  const targets = new Set<string>();
  for (const field of fields) {
    if (field.mapped && field.inputvarfields) {
      if (targets.has(field.inputvarfields)) {
        errors.push({ 
          field: 'inputvarfields', 
          message: `Duplicate target mapping: ${field.inputvarfields}` 
        });
      }
      targets.add(field.inputvarfields);
    }
  }

  // Validate each field
  for (const field of fields) {
    const fieldErrors = validateField(field);
    errors.push(...fieldErrors);
  }

  return errors;
}

// ============================================================================
// SERIALIZATION FUNCTIONS
// ============================================================================

/**
 * Convert field to CSV-friendly format for export
 * 
 * @param field - Field to convert
 * @returns Object suitable for CSV export
 */
export function fieldToExportFormat(field: Field): Record<string, string> {
  return {
    'CSV Column': field.field_name,
    'Mapped': field.mapped ? 'Yes' : 'No',
    'Target Step': field.inputvarfields || '-'
  };
}

/**
 * Create a lookup map from fields for fast value substitution
 * 
 * @param fields - Array of fields
 * @returns Map of target label -> field name
 */
export function createFieldLookupMap(fields: Field[]): Map<string, string> {
  const map = new Map<string, string>();
  
  for (const field of fields) {
    if (field.mapped && field.inputvarfields) {
      map.set(field.inputvarfields, field.field_name);
    }
  }
  
  return map;
}

/**
 * Create reverse lookup map for field resolution
 * 
 * @param fields - Array of fields
 * @returns Map of field name -> target label
 */
export function createReverseFieldLookupMap(fields: Field[]): Map<string, string> {
  const map = new Map<string, string>();
  
  for (const field of fields) {
    if (field.mapped && field.inputvarfields) {
      map.set(field.field_name, field.inputvarfields);
    }
  }
  
  return map;
}
