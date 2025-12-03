/**
 * CSVParser - CSV File Parsing Implementation
 * @module core/csv/CSVParser
 * @version 1.0.0
 * 
 * Implements ICSVParser using Papa Parse library for robust CSV parsing
 * with support for various delimiters, encodings, and error handling.
 * 
 * ## Features
 * - Auto-detect delimiter (comma, tab, semicolon, pipe)
 * - Handle quoted fields and embedded newlines
 * - Skip empty rows (configurable)
 * - Trim whitespace from values (configurable)
 * - Provide preview rows for UI display
 * - Track parse errors and warnings
 * 
 * @example
 * ```typescript
 * const parser = new CSVParser();
 * 
 * // Parse file
 * const result = await parser.parseFile(file);
 * if (result.success) {
 *   console.log('Headers:', result.data.headers);
 *   console.log('Rows:', result.data.rowCount);
 * }
 * 
 * // Get preview
 * const preview = parser.preview(result.data, 5);
 * ```
 */

import type {
  ICSVParser,
  CSVData,
  CSVRow,
  ParseResult,
  ParseError,
  ParseWarning,
  CSVParserConfig,
  SupportedFileType,
} from './ICSVParser';

import {
  DEFAULT_PARSER_CONFIG,
  createParseError,
  detectFileType,
} from './ICSVParser';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Papa Parse result structure
 */
interface PapaParseResult {
  data: string[][] | Record<string, string>[];
  errors: Array<{
    type: string;
    code: string;
    message: string;
    row?: number;
  }>;
  meta: {
    delimiter: string;
    linebreak: string;
    aborted: boolean;
    truncated: boolean;
    fields?: string[];
  };
}

/**
 * Papa Parse configuration
 */
interface PapaParseConfig {
  delimiter?: string;
  newline?: string;
  quoteChar?: string;
  escapeChar?: string;
  header?: boolean;
  transformHeader?: (header: string) => string;
  dynamicTyping?: boolean;
  preview?: number;
  encoding?: string;
  worker?: boolean;
  comments?: string | boolean;
  download?: boolean;
  skipEmptyLines?: boolean | 'greedy';
  fastMode?: boolean;
  withCredentials?: boolean;
  transform?: (value: string, field: string | number) => string;
  complete?: (results: PapaParseResult) => void;
  error?: (error: Error) => void;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Read file as text
 */
async function readFileAsText(file: File, encoding: string = 'utf-8'): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      resolve(reader.result as string);
    };
    
    reader.onerror = () => {
      reject(new Error(`Failed to read file: ${reader.error?.message || 'Unknown error'}`));
    };
    
    reader.readAsText(file, encoding);
  });
}

/**
 * Convert Papa Parse errors to ParseError array
 */
function convertPapaErrors(errors: PapaParseResult['errors']): ParseError[] {
  return errors.map(error => createParseError(
    'parse_error',
    error.message,
    error.row
  ));
}

/**
 * Check for inconsistent column counts
 */
function checkColumnConsistency(
  rows: CSVRow[],
  headers: string[]
): ParseWarning | null {
  const expectedCount = headers.length;
  const inconsistentRows: number[] = [];
  
  rows.forEach((row, index) => {
    const actualCount = Object.keys(row).length;
    if (actualCount !== expectedCount) {
      inconsistentRows.push(index + 1); // 1-indexed for user display
    }
  });
  
  if (inconsistentRows.length > 0) {
    return {
      type: 'inconsistent_columns',
      message: `${inconsistentRows.length} row(s) have inconsistent column counts`,
      rows: inconsistentRows.slice(0, 10), // Limit to first 10
    };
  }
  
  return null;
}

/**
 * Check for empty cells
 */
function checkEmptyCells(
  rows: CSVRow[],
  headers: string[]
): ParseWarning | null {
  const emptyCells: Array<{ row: number; column: string }> = [];
  
  rows.forEach((row, rowIndex) => {
    headers.forEach(header => {
      const value = row[header];
      if (value === '' || value === undefined || value === null) {
        emptyCells.push({ row: rowIndex + 1, column: header });
      }
    });
  });
  
  if (emptyCells.length > 0) {
    const affectedColumns = [...new Set(emptyCells.map(c => c.column))];
    const affectedRows = [...new Set(emptyCells.map(c => c.row))];
    
    return {
      type: 'empty_cell',
      message: `${emptyCells.length} empty cell(s) found in ${affectedColumns.length} column(s)`,
      columns: affectedColumns.slice(0, 10),
      rows: affectedRows.slice(0, 10),
    };
  }
  
  return null;
}

/**
 * Trim values in row
 */
function trimRow(row: CSVRow): CSVRow {
  const trimmed: CSVRow = {};
  
  for (const [key, value] of Object.entries(row)) {
    trimmed[key.trim()] = typeof value === 'string' ? value.trim() : value;
  }
  
  return trimmed;
}

/**
 * Check if row is empty
 */
function isEmptyRow(row: CSVRow): boolean {
  return Object.values(row).every(
    value => value === '' || value === undefined || value === null
  );
}

// ============================================================================
// PAPA PARSE WRAPPER
// ============================================================================

/**
 * Parse CSV string using Papa Parse
 */
function parsePapa(
  content: string,
  config: PapaParseConfig
): PapaParseResult {
  // Check if Papa Parse is available
  if (typeof Papa === 'undefined') {
    // Return mock result for testing environments
    return parseFallback(content, config);
  }
  
  return Papa.parse(content, config);
}

/**
 * Fallback parser for environments without Papa Parse
 */
function parseFallback(
  content: string,
  config: PapaParseConfig
): PapaParseResult {
  const delimiter = config.delimiter || ',';
  const lines = content.split(/\r?\n/);
  const data: Record<string, string>[] = [];
  const errors: PapaParseResult['errors'] = [];
  
  if (lines.length === 0) {
    return {
      data: [],
      errors: [{ type: 'Empty', code: 'EmptyFile', message: 'File is empty' }],
      meta: { delimiter, linebreak: '\n', aborted: false, truncated: false },
    };
  }
  
  // Parse headers
  const headers = lines[0].split(delimiter).map(h => h.trim());
  
  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    
    if (config.skipEmptyLines && line.trim() === '') {
      continue;
    }
    
    const values = line.split(delimiter);
    const row: Record<string, string> = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() || '';
    });
    
    data.push(row);
    
    // Check preview limit
    if (config.preview && data.length >= config.preview) {
      break;
    }
  }
  
  return {
    data,
    errors,
    meta: {
      delimiter,
      linebreak: '\n',
      aborted: false,
      truncated: config.preview ? data.length >= config.preview : false,
      fields: headers,
    },
  };
}

// Declare Papa as global (provided by papaparse library)
declare const Papa: {
  parse: (content: string, config: PapaParseConfig) => PapaParseResult;
};

// ============================================================================
// CSV PARSER CLASS
// ============================================================================

/**
 * CSV Parser implementation using Papa Parse
 */
export class CSVParser implements ICSVParser {
  private config: Required<CSVParserConfig>;
  private stats = {
    filesProcessed: 0,
    totalRowsParsed: 0,
    parseErrors: 0,
  };
  
  constructor(config?: Partial<CSVParserConfig>) {
    this.config = {
      ...DEFAULT_PARSER_CONFIG,
      ...config,
      normalization: {
        ...DEFAULT_PARSER_CONFIG.normalization,
        ...config?.normalization,
      },
    };
  }
  
  // ==========================================================================
  // FILE PARSING
  // ==========================================================================
  
  /**
   * Parse a file to CSV data
   */
  async parseFile(file: File): Promise<ParseResult> {
    // Detect file type
    const fileInfo = detectFileType(file);
    
    if (!fileInfo.supported) {
      return {
        success: false,
        errors: [createParseError(
          'invalid_format',
          `Unsupported file type: ${fileInfo.extension || 'unknown'}`
        )],
      };
    }
    
    // Handle Excel files differently
    if (fileInfo.type === 'xlsx' || fileInfo.type === 'xls') {
      return this.parseExcelFile(file);
    }
    
    try {
      // Read file content
      const content = await readFileAsText(file, this.config.encoding);
      
      // Parse content
      const result = this.parseString(content, file.name);
      
      // Update file type
      if (result.success && result.data) {
        result.data.fileType = fileInfo.type as SupportedFileType;
        result.data.fileName = file.name;
      }
      
      this.stats.filesProcessed++;
      
      return result;
      
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.stats.parseErrors++;
      
      return {
        success: false,
        errors: [createParseError('file_read', message)],
      };
    }
  }
  
  /**
   * Parse Excel file (stub - requires xlsx library)
   */
  private async parseExcelFile(file: File): Promise<ParseResult> {
    // Check if XLSX library is available
    if (typeof XLSX === 'undefined') {
      return {
        success: false,
        errors: [createParseError(
          'invalid_format',
          'Excel parsing requires XLSX library. Please use CSV format or ensure xlsx is loaded.'
        )],
      };
    }
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      // Use first sheet
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        return {
          success: false,
          errors: [createParseError('empty_file', 'Excel file has no sheets')],
        };
      }
      
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<string[]>(sheet, {
        header: 1,
        defval: '',
      }) as string[][];
      
      if (jsonData.length === 0) {
        return {
          success: false,
          errors: [createParseError('empty_file', 'Excel sheet is empty')],
        };
      }
      
      // Extract headers and rows
      const headers = jsonData[0].map(h => String(h).trim());
      const rows: CSVRow[] = [];
      
      for (let i = 1; i < jsonData.length; i++) {
        if (this.config.maxRows > 0 && rows.length >= this.config.maxRows) {
          break;
        }
        
        const rowData = jsonData[i];
        const row: CSVRow = {};
        
        headers.forEach((header, index) => {
          const value = rowData[index];
          row[header] = value !== undefined ? String(value) : '';
        });
        
        if (this.config.skipEmptyRows && isEmptyRow(row)) {
          continue;
        }
        
        if (this.config.trimValues) {
          rows.push(trimRow(row));
        } else {
          rows.push(row);
        }
      }
      
      const data: CSVData = {
        headers,
        rows,
        rowCount: rows.length,
        columnCount: headers.length,
        fileName: file.name,
        fileType: 'xlsx',
        parsedAt: Date.now(),
      };
      
      this.stats.filesProcessed++;
      this.stats.totalRowsParsed += rows.length;
      
      return { success: true, data };
      
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.stats.parseErrors++;
      
      return {
        success: false,
        errors: [createParseError('parse_error', `Excel parse error: ${message}`)],
      };
    }
  }
  
  // ==========================================================================
  // STRING PARSING
  // ==========================================================================
  
  /**
   * Parse CSV string content
   */
  parseString(content: string, fileName?: string): ParseResult {
    if (!content || content.trim() === '') {
      return {
        success: false,
        errors: [createParseError('empty_file', 'Content is empty')],
      };
    }
    
    try {
      // Configure Papa Parse
      const papaConfig: PapaParseConfig = {
        header: true,
        skipEmptyLines: this.config.skipEmptyRows ? 'greedy' : false,
        transformHeader: (header) => this.config.trimValues ? header.trim() : header,
        transform: this.config.trimValues 
          ? (value) => value.trim()
          : undefined,
      };
      
      // Use custom delimiter if specified
      if (this.config.delimiter) {
        papaConfig.delimiter = this.config.delimiter;
      }
      
      // Apply max rows if specified
      if (this.config.maxRows > 0) {
        papaConfig.preview = this.config.maxRows;
      }
      
      // Parse
      const result = parsePapa(content, papaConfig);
      
      // Check for errors
      if (result.errors.length > 0) {
        const criticalErrors = result.errors.filter(
          e => e.type === 'FieldMismatch' || e.type === 'TooManyFields' || e.type === 'TooFewFields'
        );
        
        if (criticalErrors.length > 0 && result.data.length === 0) {
          return {
            success: false,
            errors: convertPapaErrors(criticalErrors),
          };
        }
      }
      
      // Get headers
      const headers = result.meta.fields || [];
      
      if (headers.length === 0) {
        return {
          success: false,
          errors: [createParseError('no_headers', 'No headers found in CSV')],
        };
      }
      
      // Get rows
      let rows = result.data as CSVRow[];
      
      // Filter empty rows if configured
      if (this.config.skipEmptyRows) {
        rows = rows.filter(row => !isEmptyRow(row));
      }
      
      // Build CSV data
      const data: CSVData = {
        headers,
        rows,
        rowCount: rows.length,
        columnCount: headers.length,
        fileName,
        fileType: 'csv',
        parsedAt: Date.now(),
      };
      
      // Collect warnings
      const warnings: ParseWarning[] = [];
      
      // Check column consistency
      const consistencyWarning = checkColumnConsistency(rows, headers);
      if (consistencyWarning) {
        warnings.push(consistencyWarning);
      }
      
      // Check empty cells
      const emptyCellWarning = checkEmptyCells(rows, headers);
      if (emptyCellWarning) {
        warnings.push(emptyCellWarning);
      }
      
      // Check truncation
      if (result.meta.truncated) {
        warnings.push({
          type: 'truncated',
          message: `Data truncated to ${this.config.maxRows} rows`,
        });
      }
      
      // Convert Papa errors to warnings (non-critical)
      if (result.errors.length > 0) {
        warnings.push({
          type: 'encoding_issue',
          message: `${result.errors.length} parsing issue(s) encountered`,
          rows: result.errors.map(e => e.row).filter((r): r is number => r !== undefined),
        });
      }
      
      this.stats.totalRowsParsed += rows.length;
      
      return {
        success: true,
        data,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
      
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.stats.parseErrors++;
      
      return {
        success: false,
        errors: [createParseError('parse_error', message)],
      };
    }
  }
  
  // ==========================================================================
  // DATA ACCESS
  // ==========================================================================
  
  /**
   * Extract headers from CSV data
   */
  extractHeaders(data: CSVData): string[] {
    return [...data.headers];
  }
  
  /**
   * Get preview rows
   */
  preview(data: CSVData, rowCount?: number): CSVRow[] {
    const count = rowCount ?? this.config.previewRowCount;
    return data.rows.slice(0, count);
  }
  
  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================
  
  /**
   * Get configuration
   */
  getConfig(): Required<CSVParserConfig> {
    return { ...this.config };
  }
  
  /**
   * Update configuration
   */
  setConfig(config: Partial<CSVParserConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      normalization: {
        ...this.config.normalization,
        ...config.normalization,
      },
    };
  }
  
  // ==========================================================================
  // STATISTICS
  // ==========================================================================
  
  /**
   * Get parse statistics
   */
  getStats(): typeof this.stats {
    return { ...this.stats };
  }
  
  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      filesProcessed: 0,
      totalRowsParsed: 0,
      parseErrors: 0,
    };
  }
}

// Declare XLSX as global (provided by xlsx library)
declare const XLSX: {
  read: (data: ArrayBuffer, options: { type: string }) => {
    SheetNames: string[];
    Sheets: Record<string, unknown>;
  };
  utils: {
    sheet_to_json: <T>(sheet: unknown, options?: { header?: number | 1; defval?: string }) => T[];
  };
};

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a CSVParser
 */
export function createCSVParser(config?: Partial<CSVParserConfig>): CSVParser {
  return new CSVParser(config);
}

/**
 * Create parser with larger preview
 */
export function createPreviewParser(previewRowCount: number = 50): CSVParser {
  return new CSVParser({ previewRowCount });
}

/**
 * Create parser for large files
 */
export function createLargeFileParser(maxRows: number = 10000): CSVParser {
  return new CSVParser({
    maxRows,
    skipEmptyRows: true,
    trimValues: true,
  });
}

// ============================================================================
// SINGLETON
// ============================================================================

let defaultParser: CSVParser | null = null;

/**
 * Get default parser instance
 */
export function getCSVParser(): CSVParser {
  if (!defaultParser) {
    defaultParser = new CSVParser();
  }
  return defaultParser;
}

/**
 * Reset default parser
 */
export function resetCSVParser(): void {
  defaultParser = null;
}
