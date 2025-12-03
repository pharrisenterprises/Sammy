/**
 * ICSVParser - CSV Parsing and Field Mapping Interface
 * @module core/csv/ICSVParser
 * @version 1.0.0
 * 
 * Defines contracts for CSV/Excel parsing, field extraction,
 * auto-mapping to recorded step labels, and data validation.
 * 
 * ## Parsing Flow
 * 1. parseFile(): Read and parse file to structured data
 * 2. extractHeaders(): Get column names from first row
 * 3. preview(): Return first N rows for display
 * 4. autoMap(): Match columns to step labels
 * 5. validate(): Check data quality and mappings
 * 
 * ## Auto-Mapping Algorithm
 * Uses Dice coefficient (bigram overlap) for fuzzy matching:
 * - Normalize strings (lowercase, remove spaces/underscores)
 * - Compare each CSV header to each step label
 * - Select best match above threshold (default 0.3)
 * 
 * @example
 * ```typescript
 * const parser = createCSVParser();
 * 
 * // Parse file
 * const result = await parser.parseFile(file);
 * 
 * // Auto-map to steps
 * const mappings = parser.autoMap(result.headers, stepLabels);
 * 
 * // Validate
 * const validation = parser.validate(result, mappings);
 * ```
 */

import type { Step } from '../types/step';
import type { Field } from '../types/field';

// ============================================================================
// FILE TYPES
// ============================================================================

/**
 * Supported file types for parsing
 */
export type SupportedFileType = 'csv' | 'xlsx' | 'xls' | 'tsv';

/**
 * File type detection result
 */
export interface FileTypeInfo {
  /** Detected file type */
  type: SupportedFileType | 'unknown';
  
  /** File extension */
  extension: string;
  
  /** MIME type if available */
  mimeType?: string;
  
  /** Whether file type is supported */
  supported: boolean;
}

/**
 * Supported file extensions
 */
export const SUPPORTED_EXTENSIONS: readonly string[] = [
  '.csv',
  '.xlsx',
  '.xls',
  '.tsv',
] as const;

/**
 * MIME types for supported files
 */
export const SUPPORTED_MIME_TYPES: Record<string, SupportedFileType> = {
  'text/csv': 'csv',
  'text/tab-separated-values': 'tsv',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
};

// ============================================================================
// PARSE RESULT TYPES
// ============================================================================

/**
 * Single row of CSV data
 */
export type CSVRow = Record<string, string>;

/**
 * Parsed CSV data structure
 */
export interface CSVData {
  /** Column headers from first row */
  headers: string[];
  
  /** All data rows (excluding header) */
  rows: CSVRow[];
  
  /** Total row count (excluding header) */
  rowCount: number;
  
  /** Total column count */
  columnCount: number;
  
  /** Source file name */
  fileName?: string;
  
  /** Source file type */
  fileType: SupportedFileType;
  
  /** Parse timestamp */
  parsedAt: number;
}

/**
 * Parse result with potential errors
 */
export interface ParseResult {
  /** Whether parsing succeeded */
  success: boolean;
  
  /** Parsed data (if successful) */
  data?: CSVData;
  
  /** Parse errors (if failed) */
  errors?: ParseError[];
  
  /** Warnings (non-fatal issues) */
  warnings?: ParseWarning[];
}

/**
 * Parse error details
 */
export interface ParseError {
  /** Error type */
  type: 'file_read' | 'parse_error' | 'invalid_format' | 'empty_file' | 'no_headers';
  
  /** Error message */
  message: string;
  
  /** Row number (if applicable) */
  row?: number;
  
  /** Column (if applicable) */
  column?: string;
}

/**
 * Parse warning details
 */
export interface ParseWarning {
  /** Warning type */
  type: 'empty_cell' | 'inconsistent_columns' | 'encoding_issue' | 'truncated';
  
  /** Warning message */
  message: string;
  
  /** Affected row numbers */
  rows?: number[];
  
  /** Affected columns */
  columns?: string[];
}

// ============================================================================
// MAPPING TYPES
// ============================================================================

/**
 * Field mapping from CSV column to step label
 */
export interface FieldMapping {
  /** CSV column header */
  csvColumn: string;
  
  /** Mapped step label (or null if unmapped) */
  stepLabel: string | null;
  
  /** Whether mapping is active */
  mapped: boolean;
  
  /** Step index in recorded_steps (if mapped) */
  stepIndex?: number;
  
  /** Auto-mapping confidence score (0-1) */
  confidence?: number;
  
  /** Whether mapping was auto-detected */
  autoMapped: boolean;
}

/**
 * Mapping suggestion from auto-mapping
 */
export interface MappingSuggestion {
  /** CSV column header */
  csvColumn: string;
  
  /** Suggested step label */
  suggestedLabel: string;
  
  /** Confidence score (0-1) */
  confidence: number;
  
  /** Step index */
  stepIndex: number;
  
  /** Alternative suggestions (if any) */
  alternatives?: Array<{
    label: string;
    confidence: number;
    stepIndex: number;
  }>;
}

/**
 * Auto-mapping result
 */
export interface AutoMapResult {
  /** Successful mappings */
  mappings: FieldMapping[];
  
  /** Suggestions for unmapped columns */
  suggestions: MappingSuggestion[];
  
  /** Columns that couldn't be mapped */
  unmapped: string[];
  
  /** Statistics */
  stats: {
    totalColumns: number;
    mappedCount: number;
    unmappedCount: number;
    avgConfidence: number;
  };
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  
  /** Validation errors */
  errors: ValidationError[];
  
  /** Validation warnings */
  warnings: ValidationWarning[];
  
  /** Statistics */
  stats: ValidationStats;
}

/**
 * Validation error
 */
export interface ValidationError {
  /** Error type */
  type: 
    | 'empty_data'
    | 'no_mappings'
    | 'duplicate_mapping'
    | 'missing_required'
    | 'invalid_value';
  
  /** Error message */
  message: string;
  
  /** Affected column */
  column?: string;
  
  /** Affected rows */
  rows?: number[];
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  /** Warning type */
  type: 
    | 'empty_cells'
    | 'unmapped_columns'
    | 'low_confidence'
    | 'potential_duplicate';
  
  /** Warning message */
  message: string;
  
  /** Affected columns */
  columns?: string[];
  
  /** Affected rows */
  rows?: number[];
}

/**
 * Validation statistics
 */
export interface ValidationStats {
  /** Total rows */
  totalRows: number;
  
  /** Rows with all values filled */
  completeRows: number;
  
  /** Rows with empty cells */
  incompleteRows: number;
  
  /** Total mapped columns */
  mappedColumns: number;
  
  /** Total unmapped columns */
  unmappedColumns: number;
  
  /** Empty cell count */
  emptyCells: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Parser configuration
 */
export interface CSVParserConfig {
  /** Auto-mapping similarity threshold (0-1, default 0.3) */
  similarityThreshold?: number;
  
  /** Maximum rows to parse (0 = unlimited, default 0) */
  maxRows?: number;
  
  /** Preview row count (default 10) */
  previewRowCount?: number;
  
  /** Whether to trim whitespace from values (default true) */
  trimValues?: boolean;
  
  /** Whether to skip empty rows (default true) */
  skipEmptyRows?: boolean;
  
  /** Custom delimiter for CSV (default auto-detect) */
  delimiter?: string;
  
  /** Encoding (default 'utf-8') */
  encoding?: string;
  
  /** Normalization options for auto-mapping */
  normalization?: NormalizationConfig;
}

/**
 * Normalization configuration for string comparison
 */
export interface NormalizationConfig {
  /** Convert to lowercase (default true) */
  lowercase?: boolean;
  
  /** Remove spaces (default true) */
  removeSpaces?: boolean;
  
  /** Remove underscores (default true) */
  removeUnderscores?: boolean;
  
  /** Remove hyphens (default true) */
  removeHyphens?: boolean;
  
  /** Remove special characters (default false) */
  removeSpecialChars?: boolean;
}

/**
 * Default parser configuration
 */
export const DEFAULT_PARSER_CONFIG: Required<CSVParserConfig> = {
  similarityThreshold: 0.3,
  maxRows: 0,
  previewRowCount: 10,
  trimValues: true,
  skipEmptyRows: true,
  delimiter: '',
  encoding: 'utf-8',
  normalization: {
    lowercase: true,
    removeSpaces: true,
    removeUnderscores: true,
    removeHyphens: true,
    removeSpecialChars: false,
  },
};

/**
 * Default normalization configuration
 */
export const DEFAULT_NORMALIZATION_CONFIG: Required<NormalizationConfig> = {
  lowercase: true,
  removeSpaces: true,
  removeUnderscores: true,
  removeHyphens: true,
  removeSpecialChars: false,
};

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * CSV Parser interface
 */
export interface ICSVParser {
  /**
   * Parse a file to CSV data
   */
  parseFile(file: File): Promise<ParseResult>;
  
  /**
   * Parse CSV string content
   */
  parseString(content: string, fileName?: string): ParseResult;
  
  /**
   * Extract headers from CSV data
   */
  extractHeaders(data: CSVData): string[];
  
  /**
   * Get preview rows
   */
  preview(data: CSVData, rowCount?: number): CSVRow[];
  
  /**
   * Get configuration
   */
  getConfig(): Required<CSVParserConfig>;
  
  /**
   * Update configuration
   */
  setConfig(config: Partial<CSVParserConfig>): void;
}

/**
 * Field Mapper interface
 */
export interface IFieldMapper {
  /**
   * Auto-map CSV columns to step labels
   */
  autoMap(
    csvHeaders: string[],
    steps: Step[]
  ): AutoMapResult;
  
  /**
   * Get similarity score between two strings
   */
  getSimilarity(str1: string, str2: string): number;
  
  /**
   * Normalize string for comparison
   */
  normalize(str: string): string;
  
  /**
   * Create field mapping manually
   */
  createMapping(
    csvColumn: string,
    stepLabel: string | null,
    stepIndex?: number
  ): FieldMapping;
  
  /**
   * Convert mappings to Field array
   */
  toFields(mappings: FieldMapping[]): Field[];
  
  /**
   * Get configuration
   */
  getConfig(): Required<CSVParserConfig>;
  
  /**
   * Update configuration
   */
  setConfig(config: Partial<CSVParserConfig>): void;
}

/**
 * CSV Validator interface
 */
export interface ICSVValidator {
  /**
   * Validate parsed CSV data
   */
  validateData(data: CSVData): ValidationResult;
  
  /**
   * Validate field mappings
   */
  validateMappings(
    mappings: FieldMapping[],
    data: CSVData
  ): ValidationResult;
  
  /**
   * Validate complete setup (data + mappings)
   */
  validate(
    data: CSVData,
    mappings: FieldMapping[]
  ): ValidationResult;
  
  /**
   * Check if mapping has duplicates
   */
  hasDuplicateMappings(mappings: FieldMapping[]): boolean;
  
  /**
   * Get empty cells in data
   */
  getEmptyCells(data: CSVData): Array<{ row: number; column: string }>;
}

/**
 * Complete CSV Processing Service interface
 */
export interface ICSVProcessingService extends ICSVParser, IFieldMapper, ICSVValidator {
  /**
   * Process file end-to-end
   */
  processFile(
    file: File,
    steps: Step[]
  ): Promise<{
    parseResult: ParseResult;
    mappings: FieldMapping[];
    validation: ValidationResult;
  }>;
  
  /**
   * Get processing statistics
   */
  getStats(): {
    filesProcessed: number;
    totalRowsParsed: number;
    avgMappingConfidence: number;
  };
  
  /**
   * Reset statistics
   */
  resetStats(): void;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Detect file type from file object
 */
export function detectFileType(file: File): FileTypeInfo {
  const extension = getFileExtension(file.name);
  const mimeType = file.type || undefined;
  
  // Check by MIME type first
  if (mimeType && SUPPORTED_MIME_TYPES[mimeType]) {
    return {
      type: SUPPORTED_MIME_TYPES[mimeType],
      extension,
      mimeType,
      supported: true,
    };
  }
  
  // Fall back to extension
  const typeByExtension = getTypeByExtension(extension);
  
  return {
    type: typeByExtension,
    extension,
    mimeType,
    supported: typeByExtension !== 'unknown',
  };
}

/**
 * Get file extension
 */
export function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot === -1) return '';
  return fileName.slice(lastDot).toLowerCase();
}

/**
 * Get file type by extension
 */
export function getTypeByExtension(extension: string): SupportedFileType | 'unknown' {
  const ext = extension.toLowerCase();
  
  switch (ext) {
    case '.csv': return 'csv';
    case '.tsv': return 'tsv';
    case '.xlsx': return 'xlsx';
    case '.xls': return 'xls';
    default: return 'unknown';
  }
}

/**
 * Check if file type is supported
 */
export function isSupportedFile(file: File): boolean {
  return detectFileType(file).supported;
}

/**
 * Normalize string for comparison
 */
export function normalizeString(
  str: string,
  config: NormalizationConfig = DEFAULT_NORMALIZATION_CONFIG
): string {
  let result = str;
  
  if (config.lowercase) {
    result = result.toLowerCase();
  }
  
  if (config.removeSpaces) {
    result = result.replace(/\s+/g, '');
  }
  
  if (config.removeUnderscores) {
    result = result.replace(/_/g, '');
  }
  
  if (config.removeHyphens) {
    result = result.replace(/-/g, '');
  }
  
  if (config.removeSpecialChars) {
    result = result.replace(/[^a-zA-Z0-9]/g, '');
  }
  
  return result;
}

/**
 * Calculate Dice coefficient (bigram similarity)
 */
export function diceSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  if (str1.length < 2 || str2.length < 2) return 0;
  
  const bigrams1 = getBigrams(str1);
  const bigrams2 = getBigrams(str2);
  
  let intersection = 0;
  
  for (const bigram of bigrams1) {
    if (bigrams2.has(bigram)) {
      intersection++;
      bigrams2.delete(bigram); // Only count once
    }
  }
  
  return (2 * intersection) / (str1.length - 1 + str2.length - 1);
}

/**
 * Get bigrams from string
 */
function getBigrams(str: string): Set<string> {
  const bigrams = new Set<string>();
  
  for (let i = 0; i < str.length - 1; i++) {
    bigrams.add(str.slice(i, i + 2));
  }
  
  return bigrams;
}

/**
 * Create empty CSVData structure
 */
export function createEmptyCSVData(): CSVData {
  return {
    headers: [],
    rows: [],
    rowCount: 0,
    columnCount: 0,
    fileType: 'csv',
    parsedAt: Date.now(),
  };
}

/**
 * Create parse error
 */
export function createParseError(
  type: ParseError['type'],
  message: string,
  row?: number,
  column?: string
): ParseError {
  return { type, message, row, column };
}

/**
 * Create validation error
 */
export function createValidationError(
  type: ValidationError['type'],
  message: string,
  column?: string,
  rows?: number[]
): ValidationError {
  return { type, message, column, rows };
}

/**
 * Create field mapping
 */
export function createFieldMapping(
  csvColumn: string,
  stepLabel: string | null = null,
  options?: {
    stepIndex?: number;
    confidence?: number;
    autoMapped?: boolean;
  }
): FieldMapping {
  return {
    csvColumn,
    stepLabel,
    mapped: stepLabel !== null,
    stepIndex: options?.stepIndex,
    confidence: options?.confidence,
    autoMapped: options?.autoMapped ?? false,
  };
}

/**
 * Calculate mapping statistics
 */
export function calculateMappingStats(
  mappings: FieldMapping[]
): AutoMapResult['stats'] {
  const mapped = mappings.filter(m => m.mapped);
  const totalConfidence = mapped.reduce((sum, m) => sum + (m.confidence || 0), 0);
  
  return {
    totalColumns: mappings.length,
    mappedCount: mapped.length,
    unmappedCount: mappings.length - mapped.length,
    avgConfidence: mapped.length > 0 ? totalConfidence / mapped.length : 0,
  };
}
