/**
 * @fileoverview Barrel export for all CSV-related types and utilities
 * @module core/csv
 * @version 1.0.0
 * 
 * This module re-exports all CSV parsing, field mapping, and data injection
 * utilities for data-driven testing.
 * 
 * CSV DATA STRUCTURE:
 * - Headers: string[] (column names from first row)
 * - Data: string[][] (array of rows, each row is array of cells)
 * - Stored in Project.csvData as string[][]
 * 
 * FIELD MAPPING (CRITICAL - snake_case properties):
 * - field_name (NOT fieldName)
 * - mapped (boolean)
 * - inputvarfields (NOT inputVarFields)
 * 
 * @example
 * ```typescript
 * // Parse CSV file
 * import { parseCsv, parseCsvFile } from '@/core/csv';
 * 
 * // Map fields
 * import { FieldMapper, autoMapFields } from '@/core/csv';
 * 
 * // Validate and extract data
 * import { validateCsv, mapAndExtractData } from '@/core/csv';
 * ```
 * 
 * @see PHASE_4_SPECIFICATIONS.md for CSV specifications
 * @see csv-processing_breakdown.md for processing details
 */

// ============================================================================
// CSV PARSER
// ============================================================================

export {
  // Types
  type CsvParseOptions,
  type CsvParseResult,
  type CsvParseError,
  type CsvMetadata,
  type CsvValidationResult,
  type CsvRowObject,
  
  // Constants
  DEFAULT_PARSE_OPTIONS,
  COMMON_DELIMITERS,
  CSV_ERROR_CODES,
  
  // Main Parser Functions
  parseCsv,
  parseCsvFile,
  parseCsvBlob,
  
  // Detection Functions
  detectDelimiter,
  detectLineEnding,
  
  // Validation
  validateCsv,
  
  // Data Access Functions
  getRowAsObject,
  getAllRowsAsObjects,
  getColumnValues,
  getColumnByIndex,
  getCellValue,
  getCellByHeader,
  
  // Serialization
  toCsvString,
  resultToCsvString,
  
  // Utilities
  previewCsv,
  countRows,
  isCsvContent
} from './csv-parser';

// ============================================================================
// FIELD MAPPER
// ============================================================================

export {
  // Types
  type FieldMapping,
  type MappingConfiguration,
  type AutoMapOptions,
  type InjectionResult,
  type BatchInjectionResult,
  
  // Constants
  DEFAULT_AUTOMAP_OPTIONS,
  
  // Field Mapper Class
  FieldMapper,
  
  // Standalone Functions
  autoMapFields,
  mapAndExtractData,
  suggestMappings,
  validateRequiredMappings,
  createFieldsFromHeaders,
  iterateRowData
} from './field-mapper';

// ============================================================================
// CONVENIENCE RE-EXPORTS
// ============================================================================

// Re-export Field type for convenience
export type { Field } from '../types';

// ============================================================================
// COMPOSITE FUNCTIONS
// ============================================================================

/**
 * Parse CSV and auto-map to fields in one step
 * 
 * Complete workflow for CSV processing: parse, map, and prepare for injection.
 * 
 * @param content - CSV string content
 * @param fields - Fields to map to
 * @param options - Parse and map options
 * @returns Combined result with parse result, mappings, and injection data
 * 
 * @example
 * ```typescript
 * const result = processCsvForTesting(csvContent, project.fields);
 * 
 * if (result.success) {
 *   // Use result.injectionData for test runs
 *   for (const row of result.injectionData.rows) {
 *     console.log('Test data:', row.values);
 *   }
 * }
 * ```
 */
export function processCsvForTesting(
  content: string,
  fields: import('../types').Field[],
  options: {
    parseOptions?: import('./csv-parser').CsvParseOptions;
    mapOptions?: import('./field-mapper').AutoMapOptions;
  } = {}
): {
  success: boolean;
  parseResult: import('./csv-parser').CsvParseResult;
  mappingConfig: import('./field-mapper').MappingConfiguration;
  injectionData: import('./field-mapper').BatchInjectionResult;
  errors: string[];
  warnings: string[];
} {
  const { parseCsv } = require('./csv-parser');
  const { FieldMapper } = require('./field-mapper');
  
  const errors: string[] = [];
  const warnings: string[] = [];

  // Parse CSV
  const parseResult = parseCsv(content, options.parseOptions || {});
  
  if (!parseResult.success) {
    for (const error of parseResult.errors) {
      if (error.type === 'error') {
        errors.push(error.message);
      } else {
        warnings.push(error.message);
      }
    }
  }

  // Map fields
  const mapper = new FieldMapper(parseResult, fields, options.mapOptions || {});
  mapper.autoMap();
  
  const mappingConfig = mapper.getConfiguration();
  
  // Add warnings for incomplete mapping
  if (!mappingConfig.complete) {
    warnings.push(`Unmapped fields: ${mappingConfig.unmappedFields.join(', ')}`);
  }
  
  if (mappingConfig.unmappedColumns.length > 0) {
    warnings.push(`Unused CSV columns: ${mappingConfig.unmappedColumns.join(', ')}`);
  }

  // Get injection data
  const injectionData = mapper.getAllRowData();

  return {
    success: errors.length === 0 && parseResult.rowCount > 0,
    parseResult,
    mappingConfig,
    injectionData,
    errors,
    warnings
  };
}

/**
 * Validate CSV file for data-driven testing
 * 
 * Comprehensive validation including parsing, field mapping, and data quality.
 * 
 * @param content - CSV string content
 * @param fields - Expected fields
 * @param requiredFields - Field names that must be mapped
 * @returns Validation result
 */
export function validateCsvForTesting(
  content: string,
  fields: import('../types').Field[],
  requiredFields: string[] = []
): {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
  stats: {
    rowCount: number;
    columnCount: number;
    mappedFields: number;
    totalFields: number;
    qualityScore: number;
  };
} {
  const { parseCsv, validateCsv } = require('./csv-parser');
  const { FieldMapper, validateRequiredMappings } = require('./field-mapper');

  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Parse validation
  const parseValidation = validateCsv(content);
  errors.push(...parseValidation.errors);
  warnings.push(...parseValidation.warnings);
  suggestions.push(...parseValidation.suggestions);

  // Parse CSV
  const parseResult = parseCsv(content);
  
  if (!parseResult.success) {
    return {
      valid: false,
      errors,
      warnings,
      suggestions,
      stats: {
        rowCount: 0,
        columnCount: 0,
        mappedFields: 0,
        totalFields: fields.length,
        qualityScore: 0
      }
    };
  }

  // Field mapping
  const mapper = new FieldMapper(parseResult, fields);
  mapper.autoMap();
  const config = mapper.getConfiguration();

  // Required fields validation
  if (requiredFields.length > 0) {
    const requiredResult = validateRequiredMappings(config, requiredFields);
    if (!requiredResult.valid) {
      errors.push(`Missing required fields: ${requiredResult.missingFields.join(', ')}`);
    }
  }

  // Quality checks
  if (config.qualityScore < 50) {
    warnings.push('Mapping quality is low. Consider adding more specific field names.');
  }

  if (parseResult.rowCount === 0) {
    warnings.push('CSV has no data rows.');
  }

  if (parseResult.rowCount === 1) {
    suggestions.push('CSV has only one data row. Consider adding more test data.');
  }

  if (config.unmappedFields.length > 0) {
    suggestions.push(`Add CSV columns for: ${config.unmappedFields.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions,
    stats: {
      rowCount: parseResult.rowCount,
      columnCount: parseResult.columnCount,
      mappedFields: config.mappings.length,
      totalFields: fields.length,
      qualityScore: config.qualityScore
    }
  };
}

/**
 * Get test data for a specific row by index
 * 
 * Quick access to row data for test execution.
 * 
 * @param csvData - Raw CSV data (string[][])
 * @param headers - CSV headers
 * @param fields - Fields with mappings
 * @param rowIndex - Row index (0-indexed in data, not including header)
 * @returns Field values for injection
 */
export function getTestDataForRow(
  csvData: string[][],
  headers: string[],
  fields: import('../types').Field[],
  rowIndex: number
): Record<string, string> | null {
  if (rowIndex < 0 || rowIndex >= csvData.length) {
    return null;
  }

  const row = csvData[rowIndex];
  const values: Record<string, string> = {};

  // Build header-to-index map
  const headerIndex = new Map<string, number>();
  headers.forEach((h, i) => headerIndex.set(h.toLowerCase(), i));

  // Map fields to values
  for (const field of fields) {
    if (field.mapped && field.inputvarfields) {
      const colIndex = headerIndex.get(field.inputvarfields.toLowerCase());
      if (colIndex !== undefined && colIndex < row.length) {
        values[field.field_name] = row[colIndex];
      }
    }
  }

  return values;
}

/**
 * Prepare Project.csvData for storage
 * 
 * Converts CSV parse result to the string[][] format used in Project.
 * 
 * @param parseResult - CSV parse result
 * @param includeHeaders - Whether to include headers as first row
 * @returns Data array for Project.csvData
 */
export function prepareCsvDataForStorage(
  parseResult: import('./csv-parser').CsvParseResult,
  includeHeaders: boolean = true
): string[][] {
  if (includeHeaders && parseResult.headers.length > 0) {
    return [parseResult.headers, ...parseResult.data];
  }
  return parseResult.data;
}

/**
 * Extract headers from stored CSV data
 * 
 * @param csvData - Stored CSV data (string[][])
 * @param hasHeaders - Whether first row is headers
 * @returns Headers array
 */
export function extractHeadersFromCsvData(
  csvData: string[][] | null,
  hasHeaders: boolean = true
): string[] {
  if (!csvData || csvData.length === 0) {
    return [];
  }

  if (hasHeaders) {
    return csvData[0] || [];
  }

  // Generate column names if no headers
  const columnCount = csvData[0]?.length || 0;
  return Array.from({ length: columnCount }, (_, i) => `Column ${i + 1}`);
}

/**
 * Get data rows from stored CSV data (excluding headers)
 * 
 * @param csvData - Stored CSV data (string[][])
 * @param hasHeaders - Whether first row is headers
 * @returns Data rows
 */
export function getDataRowsFromCsvData(
  csvData: string[][] | null,
  hasHeaders: boolean = true
): string[][] {
  if (!csvData || csvData.length === 0) {
    return [];
  }

  if (hasHeaders) {
    return csvData.slice(1);
  }

  return csvData;
}

/**
 * Count data rows in stored CSV data
 * 
 * @param csvData - Stored CSV data
 * @param hasHeaders - Whether first row is headers
 * @returns Number of data rows
 */
export function countDataRows(
  csvData: string[][] | null,
  hasHeaders: boolean = true
): number {
  if (!csvData) return 0;
  return hasHeaders ? Math.max(0, csvData.length - 1) : csvData.length;
}

// ============================================================================
// DOCUMENTATION
// ============================================================================

/**
 * CSV LAYER ARCHITECTURE
 * 
 * The CSV layer provides data-driven testing capabilities:
 * 
 * 1. CSV Parser (csv-parser.ts)
 *    - Parse CSV strings and files
 *    - Auto-detect delimiters and line endings
 *    - Validate CSV structure
 *    - Access data by row/column
 *    - Serialize back to CSV
 * 
 * 2. Field Mapper (field-mapper.ts)
 *    - Map CSV columns to form fields
 *    - Auto-match with fuzzy matching and synonyms
 *    - Manual mapping management
 *    - Data injection for test execution
 * 
 * DATA FLOW:
 * 
 * 1. User uploads CSV file
 * 2. parseCsvFile() reads and parses content
 * 3. FieldMapper auto-maps columns to project fields
 * 4. User can adjust mappings in UI
 * 5. During replay, getRowData() provides values for each iteration
 * 6. Field values are injected into input steps
 * 
 * STORAGE FORMAT:
 * 
 * Project.csvData: string[][] (includes headers as first row)
 * Project.fields[].inputvarfields: string (mapped CSV column name)
 * Project.fields[].mapped: boolean
 * 
 * CRITICAL NOTES:
 * 
 * - Field properties use snake_case: field_name, inputvarfields
 * - CSV data stored as string[][] in Project.csvData
 * - First row is headers (column names)
 * - Mappings link CSV columns to form field names
 * - Quality score considers field coverage and match confidence
 * 
 * USAGE RECOMMENDATIONS:
 * 
 * - Use processCsvForTesting() for complete workflow
 * - Use validateCsvForTesting() before storing
 * - Use FieldMapper for interactive mapping UI
 * - Use getTestDataForRow() during replay execution
 */
