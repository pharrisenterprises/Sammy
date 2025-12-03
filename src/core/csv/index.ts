/**
 * CSV Processing Module - Barrel Export
 * @module core/csv
 * @version 1.0.0
 * 
 * Provides CSV/Excel parsing, field mapping, and validation functionality
 * for data-driven test execution.
 * 
 * ## Quick Start
 * ```typescript
 * import { 
 *   createCSVProcessingService,
 *   type CSVData,
 *   type FieldMapping,
 * } from '@/core/csv';
 * 
 * // Create service
 * const service = createCSVProcessingService();
 * 
 * // Process file with steps
 * const result = await service.processFile(file, steps);
 * 
 * if (result.parseResult.success && result.validation.valid) {
 *   console.log('Ready for testing!');
 * }
 * ```
 * 
 * ## Module Structure
 * - **ICSVParser**: File parsing contract
 * - **IFieldMapper**: Auto-mapping contract
 * - **ICSVValidator**: Validation contract
 * - **CSVParser**: Parse CSV/Excel files
 * - **FieldMapper**: Map columns to steps
 * - **CSVValidator**: Validate data and mappings
 * - **CSVProcessingService**: Unified service
 */

// ============================================================================
// INTERFACES & TYPES (ICSVParser)
// ============================================================================

export type {
  // File types
  SupportedFileType,
  FileTypeInfo,
  
  // Parse result types
  CSVRow,
  CSVData,
  ParseResult,
  ParseError,
  ParseWarning,
  
  // Mapping types
  FieldMapping,
  MappingSuggestion,
  AutoMapResult,
  
  // Validation types
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ValidationStats,
  
  // Configuration types
  CSVParserConfig,
  NormalizationConfig,
  
  // Interface types
  ICSVParser,
  IFieldMapper,
  ICSVValidator,
  ICSVProcessingService,
} from './ICSVParser';

// ============================================================================
// CONSTANTS (ICSVParser)
// ============================================================================

export {
  // Supported types
  SUPPORTED_EXTENSIONS,
  SUPPORTED_MIME_TYPES,
  
  // Default configurations
  DEFAULT_PARSER_CONFIG,
  DEFAULT_NORMALIZATION_CONFIG,
  
  // Helper functions
  detectFileType,
  getFileExtension,
  getTypeByExtension,
  isSupportedFile,
  normalizeString,
  diceSimilarity,
  createEmptyCSVData,
  createParseError,
  createValidationError,
  createFieldMapping,
  calculateMappingStats,
} from './ICSVParser';

// ============================================================================
// CSV PARSER
// ============================================================================

export {
  // Class
  CSVParser,
  
  // Factory functions
  createCSVParser,
  createPreviewParser,
  createLargeFileParser,
  
  // Singleton
  getCSVParser,
  resetCSVParser,
} from './CSVParser';

// ============================================================================
// FIELD MAPPER
// ============================================================================

export {
  // Types
  type FieldMapperConfig,
  
  // Constants
  DEFAULT_FIELD_MAPPER_CONFIG,
  
  // Class
  FieldMapper,
  
  // Factory functions
  createFieldMapper,
  createStrictMapper,
  createLooseMapper,
  createDuplicateAllowingMapper,
  
  // Singleton
  getFieldMapper,
  resetFieldMapper,
} from './FieldMapper';

// ============================================================================
// CSV VALIDATOR
// ============================================================================

export {
  // Types
  type CSVValidatorConfig,
  type EmptyCell,
  
  // Constants
  DEFAULT_VALIDATOR_CONFIG,
  
  // Class
  CSVValidator,
  
  // Factory functions
  createCSVValidator,
  createStrictValidator,
  createLenientValidator,
  createPreviewValidator,
  
  // Singleton
  getCSVValidator,
  resetCSVValidator,
  
  // Convenience functions
  isValidCSVData,
  hasValidMappings,
  getValidationSummary,
} from './CSVValidator';

// ============================================================================
// CSV PROCESSING SERVICE
// ============================================================================

export {
  // Types
  type ProcessingResult,
  type CSVProcessingServiceConfig,
  type ProcessingStats,
  
  // Constants
  DEFAULT_SERVICE_CONFIG,
  
  // Class
  CSVProcessingService,
  
  // Factory functions
  createCSVProcessingService,
  createPreviewService,
  createFullProcessingService,
  createStrictService,
  
  // Singleton
  getCSVProcessingService,
  resetCSVProcessingService,
} from './CSVProcessingService';

// ============================================================================
// CONVENIENCE RE-EXPORTS
// ============================================================================

/**
 * All supported file extensions as a display string
 */
export const SUPPORTED_FILE_TYPES_DISPLAY = '.csv, .xlsx, .xls, .tsv';

/**
 * File input accept attribute value
 */
export const FILE_INPUT_ACCEPT = '.csv,.xlsx,.xls,.tsv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Default similarity threshold
 */
export const DEFAULT_SIMILARITY_THRESHOLD = 0.3;

/**
 * Default preview row count
 */
export const DEFAULT_PREVIEW_ROW_COUNT = 10;

/**
 * CSV module defaults
 */
export const CSV_DEFAULTS = {
  /** Similarity threshold for auto-mapping (0-1) */
  SIMILARITY_THRESHOLD: 0.3,
  
  /** Preview row count for UI display */
  PREVIEW_ROW_COUNT: 10,
  
  /** Maximum empty cell ratio before error */
  MAX_EMPTY_CELL_RATIO: 0.5,
  
  /** Minimum mapped fields required */
  MIN_MAPPED_FIELDS: 1,
  
  /** Maximum alternatives in suggestions */
  MAX_ALTERNATIVES: 3,
  
  /** Alternative suggestion threshold */
  ALTERNATIVE_THRESHOLD: 0.2,
  
  /** Low confidence warning threshold */
  LOW_CONFIDENCE_THRESHOLD: 0.3,
} as const;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Quick check if file is supported
 */
export function canProcessFile(file: File): boolean {
  return isSupportedFile(file);
}

/**
 * Get file type display name
 */
export function getFileTypeDisplayName(type: SupportedFileType | 'unknown'): string {
  switch (type) {
    case 'csv': return 'CSV (Comma Separated Values)';
    case 'tsv': return 'TSV (Tab Separated Values)';
    case 'xlsx': return 'Excel Workbook (.xlsx)';
    case 'xls': return 'Excel 97-2003 (.xls)';
    default: return 'Unknown';
  }
}

/**
 * Format row count for display
 */
export function formatRowCount(count: number): string {
  if (count === 0) return 'No rows';
  if (count === 1) return '1 row';
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k rows`;
  return `${count} rows`;
}

/**
 * Format mapping status for display
 */
export function formatMappingStatus(mapped: number, total: number): string {
  if (total === 0) return 'No columns';
  if (mapped === 0) return 'No columns mapped';
  if (mapped === total) return 'All columns mapped';
  return `${mapped} of ${total} columns mapped`;
}

/**
 * Format confidence score for display
 */
export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

/**
 * Get confidence level label
 */
export function getConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= 0.7) return 'high';
  if (confidence >= 0.4) return 'medium';
  return 'low';
}

/**
 * Get confidence level color for UI
 */
export function getConfidenceColor(confidence: number): string {
  const level = getConfidenceLevel(confidence);
  switch (level) {
    case 'high': return 'green';
    case 'medium': return 'yellow';
    case 'low': return 'red';
  }
}

/**
 * Reset all CSV module singletons (for testing)
 */
export function resetAllCSVSingletons(): void {
  resetCSVParser();
  resetFieldMapper();
  resetCSVValidator();
  resetCSVProcessingService();
}

// ============================================================================
// TYPE IMPORTS FOR INTERNAL USE
// ============================================================================

import type { SupportedFileType } from './ICSVParser';
import { isSupportedFile } from './ICSVParser';
import { resetCSVParser } from './CSVParser';
import { resetFieldMapper } from './FieldMapper';
import { resetCSVValidator } from './CSVValidator';
import { resetCSVProcessingService } from './CSVProcessingService';
