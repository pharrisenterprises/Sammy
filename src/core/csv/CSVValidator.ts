/**
 * CSVValidator - CSV Data and Mapping Validation
 * @module core/csv/CSVValidator
 * @version 1.0.0
 * 
 * Implements ICSVValidator for comprehensive validation of parsed CSV
 * data and field mappings with detailed error reporting.
 * 
 * ## Validation Checks
 * 
 * ### Data Validation
 * - Empty data detection
 * - Header presence check
 * - Row consistency check
 * - Empty cell detection
 * 
 * ### Mapping Validation
 * - At least one mapping required
 * - Duplicate mapping detection
 * - Low confidence warnings
 * - Unmapped column warnings
 * 
 * @example
 * ```typescript
 * const validator = new CSVValidator();
 * 
 * // Validate data
 * const dataResult = validator.validateData(csvData);
 * 
 * // Validate mappings
 * const mappingResult = validator.validateMappings(mappings, csvData);
 * 
 * // Full validation
 * const fullResult = validator.validate(csvData, mappings);
 * ```
 */

import type {
  ICSVValidator,
  CSVData,
  CSVRow,
  FieldMapping,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ValidationStats,
} from './ICSVParser';

import { createValidationError } from './ICSVParser';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Validator configuration
 */
export interface CSVValidatorConfig {
  /** Require at least one mapping (default true) */
  requireMapping?: boolean;
  
  /** Minimum mapped fields required (default 1) */
  minMappedFields?: number;
  
  /** Allow duplicate mappings (default false) */
  allowDuplicateMappings?: boolean;
  
  /** Warn on empty cells (default true) */
  warnOnEmptyCells?: boolean;
  
  /** Maximum empty cell percentage before error (default 0.5 = 50%) */
  maxEmptyCellRatio?: number;
  
  /** Minimum confidence threshold for warnings (default 0.3) */
  lowConfidenceThreshold?: number;
  
  /** Require all columns to be mapped (default false) */
  requireAllColumnsMapped?: boolean;
}

/**
 * Default validator configuration
 */
export const DEFAULT_VALIDATOR_CONFIG: Required<CSVValidatorConfig> = {
  requireMapping: true,
  minMappedFields: 1,
  allowDuplicateMappings: false,
  warnOnEmptyCells: true,
  maxEmptyCellRatio: 0.5,
  lowConfidenceThreshold: 0.3,
  requireAllColumnsMapped: false,
};

/**
 * Empty cell location
 */
export interface EmptyCell {
  row: number;
  column: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Count empty cells in a row
 */
function countEmptyCellsInRow(row: CSVRow, headers: string[]): number {
  let count = 0;
  
  for (const header of headers) {
    const value = row[header];
    if (value === '' || value === undefined || value === null) {
      count++;
    }
  }
  
  return count;
}

/**
 * Check if row is complete (all values present)
 */
function isRowComplete(row: CSVRow, headers: string[]): boolean {
  return countEmptyCellsInRow(row, headers) === 0;
}

/**
 * Get duplicate items in array
 */
function getDuplicates<T>(items: T[]): T[] {
  const seen = new Set<T>();
  const duplicates = new Set<T>();
  
  for (const item of items) {
    if (seen.has(item)) {
      duplicates.add(item);
    } else {
      seen.add(item);
    }
  }
  
  return [...duplicates];
}

// ============================================================================
// CSV VALIDATOR CLASS
// ============================================================================

/**
 * CSV Validator implementation
 */
export class CSVValidator implements ICSVValidator {
  private config: Required<CSVValidatorConfig>;
  
  constructor(config?: Partial<CSVValidatorConfig>) {
    this.config = {
      ...DEFAULT_VALIDATOR_CONFIG,
      ...config,
    };
  }
  
  // ==========================================================================
  // DATA VALIDATION
  // ==========================================================================
  
  /**
   * Validate parsed CSV data
   */
  validateData(data: CSVData): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    // Check for empty data
    if (!data || data.rowCount === 0) {
      errors.push(createValidationError(
        'empty_data',
        'CSV data is empty. Please upload a file with data rows.'
      ));
      
      return {
        valid: false,
        errors,
        warnings,
        stats: this.createEmptyStats(),
      };
    }
    
    // Check for headers
    if (data.headers.length === 0) {
      errors.push(createValidationError(
        'empty_data',
        'No headers found in CSV. The first row should contain column names.'
      ));
      
      return {
        valid: false,
        errors,
        warnings,
        stats: this.createEmptyStats(),
      };
    }
    
    // Calculate statistics
    const stats = this.calculateStats(data);
    
    // Check empty cell ratio
    const totalCells = data.rowCount * data.columnCount;
    const emptyCellRatio = totalCells > 0 ? stats.emptyCells / totalCells : 0;
    
    if (emptyCellRatio > this.config.maxEmptyCellRatio) {
      errors.push(createValidationError(
        'invalid_value',
        `Too many empty cells (${(emptyCellRatio * 100).toFixed(1)}%). ` +
        `Maximum allowed is ${(this.config.maxEmptyCellRatio * 100).toFixed(0)}%.`
      ));
    }
    
    // Warn about empty cells
    if (this.config.warnOnEmptyCells && stats.emptyCells > 0) {
      const emptyCellLocations = this.getEmptyCells(data);
      const affectedColumns = [...new Set(emptyCellLocations.map(c => c.column))];
      const affectedRows = [...new Set(emptyCellLocations.map(c => c.row))];
      
      warnings.push({
        type: 'empty_cells',
        message: `${stats.emptyCells} empty cell(s) found in ${affectedColumns.length} column(s)`,
        columns: affectedColumns.slice(0, 10),
        rows: affectedRows.slice(0, 10),
      });
    }
    
    // Warn about incomplete rows
    if (this.config.warnOnEmptyCells && stats.incompleteRows > 0) {
      warnings.push({
        type: 'empty_cells',
        message: `${stats.incompleteRows} row(s) have missing values`,
        rows: this.getIncompleteRowIndices(data).slice(0, 10),
      });
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      stats,
    };
  }
  
  // ==========================================================================
  // MAPPING VALIDATION
  // ==========================================================================
  
  /**
   * Validate field mappings
   */
  validateMappings(
    mappings: FieldMapping[],
    data: CSVData
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    // Check for mappings array
    if (!mappings || mappings.length === 0) {
      if (this.config.requireMapping) {
        errors.push(createValidationError(
          'no_mappings',
          'No field mappings provided. Please map at least one CSV column to a step.'
        ));
      }
      
      return {
        valid: errors.length === 0,
        errors,
        warnings,
        stats: this.calculateStats(data, mappings),
      };
    }
    
    // Count mapped fields
    const mappedFields = mappings.filter(m => m.mapped);
    
    // Check minimum mapped fields
    if (this.config.requireMapping && mappedFields.length < this.config.minMappedFields) {
      errors.push(createValidationError(
        'no_mappings',
        `At least ${this.config.minMappedFields} field(s) must be mapped. ` +
        `Currently ${mappedFields.length} field(s) mapped.`
      ));
    }
    
    // Check for duplicate mappings
    if (!this.config.allowDuplicateMappings) {
      const duplicateCheck = this.hasDuplicateMappings(mappings);
      
      if (duplicateCheck) {
        const stepIndices = mappedFields
          .filter(m => m.stepIndex !== undefined)
          .map(m => m.stepIndex!);
        const duplicates = getDuplicates(stepIndices);
        
        errors.push(createValidationError(
          'duplicate_mapping',
          `Duplicate mappings detected. Step indices ${duplicates.join(', ')} are mapped multiple times.`,
          undefined,
          undefined
        ));
      }
    }
    
    // Check for unmapped columns
    const unmappedColumns = mappings.filter(m => !m.mapped).map(m => m.csvColumn);
    
    if (this.config.requireAllColumnsMapped && unmappedColumns.length > 0) {
      errors.push(createValidationError(
        'missing_required',
        `All columns must be mapped. Unmapped: ${unmappedColumns.join(', ')}`
      ));
    } else if (unmappedColumns.length > 0) {
      warnings.push({
        type: 'unmapped_columns',
        message: `${unmappedColumns.length} column(s) are not mapped: ${unmappedColumns.slice(0, 5).join(', ')}` +
          (unmappedColumns.length > 5 ? '...' : ''),
        columns: unmappedColumns,
      });
    }
    
    // Check for low confidence mappings
    const lowConfidenceMappings = mappedFields.filter(
      m => m.confidence !== undefined && m.confidence < this.config.lowConfidenceThreshold
    );
    
    if (lowConfidenceMappings.length > 0) {
      const columns = lowConfidenceMappings.map(m => m.csvColumn);
      
      warnings.push({
        type: 'low_confidence',
        message: `${lowConfidenceMappings.length} mapping(s) have low confidence scores and may be incorrect`,
        columns,
      });
    }
    
    // Check for potential duplicates (same step label mapped)
    const mappedLabels = mappedFields
      .filter(m => m.stepLabel)
      .map(m => m.stepLabel!);
    const duplicateLabels = getDuplicates(mappedLabels);
    
    if (duplicateLabels.length > 0 && this.config.allowDuplicateMappings) {
      warnings.push({
        type: 'potential_duplicate',
        message: `Multiple columns map to the same step: ${duplicateLabels.join(', ')}`,
        columns: duplicateLabels,
      });
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      stats: this.calculateStats(data, mappings),
    };
  }
  
  // ==========================================================================
  // COMBINED VALIDATION
  // ==========================================================================
  
  /**
   * Validate complete setup (data + mappings)
   */
  validate(
    data: CSVData,
    mappings: FieldMapping[]
  ): ValidationResult {
    // Validate data first
    const dataResult = this.validateData(data);
    
    // If data validation fails critically, return early
    if (dataResult.errors.some(e => e.type === 'empty_data')) {
      return dataResult;
    }
    
    // Validate mappings
    const mappingResult = this.validateMappings(mappings, data);
    
    // Combine results
    const errors = [...dataResult.errors, ...mappingResult.errors];
    const warnings = [...dataResult.warnings, ...mappingResult.warnings];
    
    // Use mapping result stats (more complete)
    const stats = mappingResult.stats;
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      stats,
    };
  }
  
  // ==========================================================================
  // UTILITIES
  // ==========================================================================
  
  /**
   * Check if mapping has duplicates
   */
  hasDuplicateMappings(mappings: FieldMapping[]): boolean {
    const mappedStepIndices = mappings
      .filter(m => m.mapped && m.stepIndex !== undefined)
      .map(m => m.stepIndex!);
    
    const uniqueIndices = new Set(mappedStepIndices);
    
    return mappedStepIndices.length !== uniqueIndices.size;
  }
  
  /**
   * Get empty cells in data
   */
  getEmptyCells(data: CSVData): EmptyCell[] {
    const emptyCells: EmptyCell[] = [];
    
    data.rows.forEach((row, rowIndex) => {
      data.headers.forEach(header => {
        const value = row[header];
        if (value === '' || value === undefined || value === null) {
          emptyCells.push({
            row: rowIndex + 1, // 1-indexed for user display
            column: header,
          });
        }
      });
    });
    
    return emptyCells;
  }
  
  /**
   * Get indices of incomplete rows
   */
  getIncompleteRowIndices(data: CSVData): number[] {
    const indices: number[] = [];
    
    data.rows.forEach((row, index) => {
      if (!isRowComplete(row, data.headers)) {
        indices.push(index + 1); // 1-indexed for user display
      }
    });
    
    return indices;
  }
  
  /**
   * Get columns with empty values
   */
  getColumnsWithEmptyValues(data: CSVData): string[] {
    const columnsWithEmpty = new Set<string>();
    
    data.rows.forEach(row => {
      data.headers.forEach(header => {
        const value = row[header];
        if (value === '' || value === undefined || value === null) {
          columnsWithEmpty.add(header);
        }
      });
    });
    
    return [...columnsWithEmpty];
  }
  
  /**
   * Get rows with all empty values
   */
  getEmptyRows(data: CSVData): number[] {
    const emptyRows: number[] = [];
    
    data.rows.forEach((row, index) => {
      const allEmpty = data.headers.every(header => {
        const value = row[header];
        return value === '' || value === undefined || value === null;
      });
      
      if (allEmpty) {
        emptyRows.push(index + 1);
      }
    });
    
    return emptyRows;
  }
  
  // ==========================================================================
  // STATISTICS
  // ==========================================================================
  
  /**
   * Calculate validation statistics
   */
  calculateStats(data: CSVData, mappings?: FieldMapping[]): ValidationStats {
    if (!data || data.rowCount === 0) {
      return this.createEmptyStats();
    }
    
    let emptyCells = 0;
    let completeRows = 0;
    
    for (const row of data.rows) {
      const emptyInRow = countEmptyCellsInRow(row, data.headers);
      emptyCells += emptyInRow;
      
      if (emptyInRow === 0) {
        completeRows++;
      }
    }
    
    const mappedColumns = mappings?.filter(m => m.mapped).length ?? 0;
    const unmappedColumns = mappings 
      ? mappings.length - mappedColumns 
      : data.columnCount;
    
    return {
      totalRows: data.rowCount,
      completeRows,
      incompleteRows: data.rowCount - completeRows,
      mappedColumns,
      unmappedColumns,
      emptyCells,
    };
  }
  
  /**
   * Create empty statistics
   */
  private createEmptyStats(): ValidationStats {
    return {
      totalRows: 0,
      completeRows: 0,
      incompleteRows: 0,
      mappedColumns: 0,
      unmappedColumns: 0,
      emptyCells: 0,
    };
  }
  
  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================
  
  /**
   * Get configuration
   */
  getConfig(): Required<CSVValidatorConfig> {
    return { ...this.config };
  }
  
  /**
   * Update configuration
   */
  setConfig(config: Partial<CSVValidatorConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a CSVValidator
 */
export function createCSVValidator(config?: Partial<CSVValidatorConfig>): CSVValidator {
  return new CSVValidator(config);
}

/**
 * Create strict validator (requires all columns mapped)
 */
export function createStrictValidator(): CSVValidator {
  return new CSVValidator({
    requireAllColumnsMapped: true,
    maxEmptyCellRatio: 0.1,
    lowConfidenceThreshold: 0.5,
  });
}

/**
 * Create lenient validator (allows empty cells, no mapping required)
 */
export function createLenientValidator(): CSVValidator {
  return new CSVValidator({
    requireMapping: false,
    warnOnEmptyCells: false,
    allowDuplicateMappings: true,
    maxEmptyCellRatio: 1.0,
  });
}

/**
 * Create validator for data preview (minimal validation)
 */
export function createPreviewValidator(): CSVValidator {
  return new CSVValidator({
    requireMapping: false,
    warnOnEmptyCells: true,
    allowDuplicateMappings: true,
  });
}

// ============================================================================
// SINGLETON
// ============================================================================

let defaultValidator: CSVValidator | null = null;

/**
 * Get default validator instance
 */
export function getCSVValidator(): CSVValidator {
  if (!defaultValidator) {
    defaultValidator = new CSVValidator();
  }
  return defaultValidator;
}

/**
 * Reset default validator
 */
export function resetCSVValidator(): void {
  defaultValidator = null;
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Quick validation check for data
 */
export function isValidCSVData(data: CSVData): boolean {
  const validator = new CSVValidator({ requireMapping: false });
  return validator.validateData(data).valid;
}

/**
 * Quick validation check for mappings
 */
export function hasValidMappings(
  mappings: FieldMapping[],
  data: CSVData
): boolean {
  const validator = new CSVValidator();
  return validator.validateMappings(mappings, data).valid;
}

/**
 * Get validation summary string
 */
export function getValidationSummary(result: ValidationResult): string {
  if (result.valid) {
    const warningCount = result.warnings.length;
    if (warningCount === 0) {
      return 'Validation passed';
    }
    return `Validation passed with ${warningCount} warning(s)`;
  }
  
  const errorCount = result.errors.length;
  return `Validation failed with ${errorCount} error(s)`;
}
