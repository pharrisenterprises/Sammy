/**
 * @fileoverview CSV parsing utilities for data-driven testing
 * @module core/csv/csv-parser
 * @version 1.0.0
 * 
 * This module provides CSV parsing capabilities for the test recorder.
 * It handles file reading, parsing, header detection, and data validation.
 * 
 * CSV data is stored as string[][] (array of rows, each row is array of cells).
 * The first row typically contains headers (column names) that can be mapped
 * to form fields.
 * 
 * @see PHASE_4_SPECIFICATIONS.md for CSV specifications
 * @see csv-processing_breakdown.md for processing details
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * CSV parsing options
 */
export interface CsvParseOptions {
  /** Field delimiter (default: ',') */
  delimiter?: string;
  /** Quote character for escaping (default: '"') */
  quote?: string;
  /** Whether first row contains headers (default: true) */
  hasHeaders?: boolean;
  /** Skip empty rows (default: true) */
  skipEmptyRows?: boolean;
  /** Trim whitespace from values (default: true) */
  trimValues?: boolean;
  /** Maximum rows to parse (default: unlimited) */
  maxRows?: number;
  /** Line ending (default: auto-detect) */
  lineEnding?: '\n' | '\r\n' | '\r' | 'auto';
}

/**
 * Parsed CSV result
 */
export interface CsvParseResult {
  /** Whether parsing was successful */
  success: boolean;
  /** Header row (column names) if hasHeaders is true */
  headers: string[];
  /** Data rows (excluding header if hasHeaders is true) */
  data: string[][];
  /** All rows including header */
  rawData: string[][];
  /** Number of rows (excluding header) */
  rowCount: number;
  /** Number of columns */
  columnCount: number;
  /** Parsing errors/warnings */
  errors: CsvParseError[];
  /** Metadata about the CSV */
  metadata: CsvMetadata;
}

/**
 * CSV parsing error
 */
export interface CsvParseError {
  /** Error type */
  type: 'error' | 'warning';
  /** Error code */
  code: string;
  /** Human-readable message */
  message: string;
  /** Row number (1-indexed) */
  row?: number;
  /** Column number (1-indexed) */
  column?: number;
}

/**
 * CSV metadata
 */
export interface CsvMetadata {
  /** Detected delimiter */
  delimiter: string;
  /** Detected line ending */
  lineEnding: string;
  /** Whether headers were detected */
  hasHeaders: boolean;
  /** Total characters in file */
  characterCount: number;
  /** Parse duration in ms */
  parseDuration: number;
}

/**
 * CSV validation result
 */
export interface CsvValidationResult {
  /** Whether CSV is valid */
  valid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
  /** Suggested fixes */
  suggestions: string[];
}

/**
 * Row object with named columns
 */
export type CsvRowObject = Record<string, string>;

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default parse options
 */
export const DEFAULT_PARSE_OPTIONS: Required<CsvParseOptions> = {
  delimiter: ',',
  quote: '"',
  hasHeaders: true,
  skipEmptyRows: true,
  trimValues: true,
  maxRows: 0, // 0 = unlimited
  lineEnding: 'auto'
};

/**
 * Common delimiters for auto-detection
 */
export const COMMON_DELIMITERS = [',', ';', '\t', '|'] as const;

/**
 * Error codes
 */
export const CSV_ERROR_CODES = {
  EMPTY_FILE: 'EMPTY_FILE',
  NO_DATA_ROWS: 'NO_DATA_ROWS',
  INCONSISTENT_COLUMNS: 'INCONSISTENT_COLUMNS',
  UNCLOSED_QUOTE: 'UNCLOSED_QUOTE',
  INVALID_ESCAPE: 'INVALID_ESCAPE',
  MAX_ROWS_EXCEEDED: 'MAX_ROWS_EXCEEDED',
  DUPLICATE_HEADERS: 'DUPLICATE_HEADERS',
  EMPTY_HEADER: 'EMPTY_HEADER'
} as const;

// ============================================================================
// MAIN PARSER
// ============================================================================

/**
 * Parse CSV string into structured data
 * 
 * @param content - CSV string content
 * @param options - Parse options
 * @returns Parse result
 * 
 * @example
 * ```typescript
 * const csv = `name,email,phone
 * John,john@example.com,555-1234
 * Jane,jane@example.com,555-5678`;
 * 
 * const result = parseCsv(csv);
 * 
 * console.log(result.headers); // ['name', 'email', 'phone']
 * console.log(result.data[0]); // ['John', 'john@example.com', '555-1234']
 * ```
 */
export function parseCsv(
  content: string,
  options: CsvParseOptions = {}
): CsvParseResult {
  const startTime = performance.now();
  const opts = { ...DEFAULT_PARSE_OPTIONS, ...options };
  const errors: CsvParseError[] = [];

  // Handle empty content
  if (!content || content.trim().length === 0) {
    return createEmptyResult(errors, 'EMPTY_FILE', 'CSV content is empty', startTime, opts);
  }

  // Detect or use specified delimiter
  const delimiter = opts.delimiter === ',' 
    ? detectDelimiter(content) || ','
    : opts.delimiter;

  // Detect line ending
  const lineEnding = opts.lineEnding === 'auto'
    ? detectLineEnding(content)
    : opts.lineEnding;

  // Parse into rows
  const rawRows = parseRows(content, delimiter, opts.quote, lineEnding);

  // Filter empty rows if configured
  let rows = opts.skipEmptyRows
    ? rawRows.filter(row => row.some(cell => cell.length > 0))
    : rawRows;

  // Trim values if configured
  if (opts.trimValues) {
    rows = rows.map(row => row.map(cell => cell.trim()));
  }

  // Apply max rows limit
  if (opts.maxRows > 0 && rows.length > opts.maxRows) {
    rows = rows.slice(0, opts.maxRows);
    errors.push({
      type: 'warning',
      code: CSV_ERROR_CODES.MAX_ROWS_EXCEEDED,
      message: `Rows limited to ${opts.maxRows}`
    });
  }

  // Extract headers and data
  let headers: string[] = [];
  let data: string[][] = rows;

  if (opts.hasHeaders && rows.length > 0) {
    headers = rows[0];
    data = rows.slice(1);

    // Validate headers
    validateHeaders(headers, errors);
  }

  // Validate column consistency
  const columnCount = headers.length || (rows[0]?.length ?? 0);
  validateColumnConsistency(rows, columnCount, errors);

  // Check for data rows
  if (data.length === 0) {
    errors.push({
      type: 'warning',
      code: CSV_ERROR_CODES.NO_DATA_ROWS,
      message: 'CSV has no data rows (only headers)'
    });
  }

  const metadata: CsvMetadata = {
    delimiter,
    lineEnding,
    hasHeaders: opts.hasHeaders,
    characterCount: content.length,
    parseDuration: performance.now() - startTime
  };

  return {
    success: errors.filter(e => e.type === 'error').length === 0,
    headers,
    data,
    rawData: rows,
    rowCount: data.length,
    columnCount,
    errors,
    metadata
  };
}

/**
 * Parse CSV from File object
 * 
 * @param file - File object to parse
 * @param options - Parse options
 * @returns Promise resolving to parse result
 */
export async function parseCsvFile(
  file: File,
  options: CsvParseOptions = {}
): Promise<CsvParseResult> {
  const content = await readFileAsText(file);
  return parseCsv(content, options);
}

/**
 * Parse CSV from Blob
 * 
 * @param blob - Blob to parse
 * @param options - Parse options
 * @returns Promise resolving to parse result
 */
export async function parseCsvBlob(
  blob: Blob,
  options: CsvParseOptions = {}
): Promise<CsvParseResult> {
  const content = await readBlobAsText(blob);
  return parseCsv(content, options);
}

// ============================================================================
// ROW PARSING
// ============================================================================

/**
 * Parse CSV content into rows
 */
function parseRows(
  content: string,
  delimiter: string,
  quote: string,
  lineEnding: string
): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;
  let i = 0;

  while (i < content.length) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (inQuotes) {
      if (char === quote) {
        if (nextChar === quote) {
          // Escaped quote
          currentCell += quote;
          i += 2;
          continue;
        } else {
          // End of quoted section
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        currentCell += char;
        i++;
        continue;
      }
    }

    // Not in quotes
    if (char === quote) {
      inQuotes = true;
      i++;
      continue;
    }

    if (char === delimiter) {
      currentRow.push(currentCell);
      currentCell = '';
      i++;
      continue;
    }

    // Check for line ending
    if (isLineEnding(content, i, lineEnding)) {
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
      i += getLineEndingLength(content, i, lineEnding);
      continue;
    }

    currentCell += char;
    i++;
  }

  // Handle last cell and row
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Check if position is at line ending
 */
function isLineEnding(content: string, pos: number, lineEnding: string): boolean {
  const char = content[pos];
  const nextChar = content[pos + 1];

  if (lineEnding === '\r\n') {
    return char === '\r' && nextChar === '\n';
  }
  if (lineEnding === '\r') {
    return char === '\r' && nextChar !== '\n';
  }
  if (lineEnding === '\n') {
    return char === '\n';
  }

  // Auto - check for any line ending
  return char === '\n' || (char === '\r');
}

/**
 * Get length of line ending at position
 */
function getLineEndingLength(content: string, pos: number, lineEnding: string): number {
  if (lineEnding === '\r\n' || (content[pos] === '\r' && content[pos + 1] === '\n')) {
    return 2;
  }
  return 1;
}

// ============================================================================
// DETECTION
// ============================================================================

/**
 * Detect delimiter from CSV content
 */
export function detectDelimiter(content: string): string | null {
  const firstLine = content.split(/\r?\n/)[0] || '';
  
  // Count occurrences of each delimiter
  const counts: Record<string, number> = {};
  
  for (const delim of COMMON_DELIMITERS) {
    counts[delim] = (firstLine.match(new RegExp(escapeRegex(delim), 'g')) || []).length;
  }

  // Find delimiter with most occurrences
  let maxCount = 0;
  let detectedDelimiter: string | null = null;

  for (const [delim, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      detectedDelimiter = delim;
    }
  }

  return detectedDelimiter;
}

/**
 * Detect line ending from content
 */
export function detectLineEnding(content: string): '\n' | '\r\n' | '\r' {
  const crlfCount = (content.match(/\r\n/g) || []).length;
  const lfCount = (content.match(/(?<!\r)\n/g) || []).length;
  const crCount = (content.match(/\r(?!\n)/g) || []).length;

  if (crlfCount >= lfCount && crlfCount >= crCount) {
    return '\r\n';
  }
  if (crCount > lfCount) {
    return '\r';
  }
  return '\n';
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate headers
 */
function validateHeaders(headers: string[], errors: CsvParseError[]): void {
  const seen = new Set<string>();

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];

    if (!header || header.trim().length === 0) {
      errors.push({
        type: 'warning',
        code: CSV_ERROR_CODES.EMPTY_HEADER,
        message: `Empty header in column ${i + 1}`,
        column: i + 1
      });
    }

    if (seen.has(header.toLowerCase())) {
      errors.push({
        type: 'warning',
        code: CSV_ERROR_CODES.DUPLICATE_HEADERS,
        message: `Duplicate header "${header}" in column ${i + 1}`,
        column: i + 1
      });
    }

    seen.add(header.toLowerCase());
  }
}

/**
 * Validate column consistency across rows
 */
function validateColumnConsistency(
  rows: string[][],
  expectedColumns: number,
  errors: CsvParseError[]
): void {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    
    if (row.length !== expectedColumns) {
      errors.push({
        type: 'warning',
        code: CSV_ERROR_CODES.INCONSISTENT_COLUMNS,
        message: `Row ${i + 1} has ${row.length} columns, expected ${expectedColumns}`,
        row: i + 1
      });
    }
  }
}

/**
 * Validate CSV content
 * 
 * @param content - CSV string
 * @param options - Parse options
 * @returns Validation result
 */
export function validateCsv(
  content: string,
  options: CsvParseOptions = {}
): CsvValidationResult {
  const result = parseCsv(content, options);
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  for (const error of result.errors) {
    if (error.type === 'error') {
      errors.push(error.message);
    } else {
      warnings.push(error.message);
    }
  }

  // Additional validation
  if (result.columnCount === 0) {
    errors.push('CSV has no columns');
    suggestions.push('Check that the correct delimiter is being used');
  }

  if (result.rowCount === 0 && result.headers.length > 0) {
    warnings.push('CSV has headers but no data rows');
    suggestions.push('Add data rows below the header row');
  }

  if (result.headers.some(h => /^\d/.test(h))) {
    warnings.push('Some headers start with numbers');
    suggestions.push('Consider using descriptive text headers');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions
  };
}

// ============================================================================
// DATA ACCESS
// ============================================================================

/**
 * Get row as object with header keys
 * 
 * @param result - Parse result
 * @param rowIndex - Row index (0-indexed, in data array)
 * @returns Row as object
 */
export function getRowAsObject(
  result: CsvParseResult,
  rowIndex: number
): CsvRowObject | null {
  if (rowIndex < 0 || rowIndex >= result.data.length) {
    return null;
  }

  const row = result.data[rowIndex];
  const obj: CsvRowObject = {};

  for (let i = 0; i < result.headers.length; i++) {
    const header = result.headers[i] || `column_${i + 1}`;
    obj[header] = row[i] ?? '';
  }

  return obj;
}

/**
 * Get all rows as objects
 * 
 * @param result - Parse result
 * @returns Array of row objects
 */
export function getAllRowsAsObjects(result: CsvParseResult): CsvRowObject[] {
  return result.data.map((_, index) => getRowAsObject(result, index)!);
}

/**
 * Get column values by header name
 * 
 * @param result - Parse result
 * @param headerName - Header name
 * @returns Array of values
 */
export function getColumnValues(
  result: CsvParseResult,
  headerName: string
): string[] {
  const columnIndex = result.headers.findIndex(
    h => h.toLowerCase() === headerName.toLowerCase()
  );

  if (columnIndex === -1) {
    return [];
  }

  return result.data.map(row => row[columnIndex] ?? '');
}

/**
 * Get column values by index
 * 
 * @param result - Parse result
 * @param columnIndex - Column index (0-indexed)
 * @returns Array of values
 */
export function getColumnByIndex(
  result: CsvParseResult,
  columnIndex: number
): string[] {
  if (columnIndex < 0 || columnIndex >= result.columnCount) {
    return [];
  }

  return result.data.map(row => row[columnIndex] ?? '');
}

/**
 * Get cell value
 * 
 * @param result - Parse result
 * @param rowIndex - Row index (0-indexed in data)
 * @param columnIndex - Column index (0-indexed)
 * @returns Cell value or null
 */
export function getCellValue(
  result: CsvParseResult,
  rowIndex: number,
  columnIndex: number
): string | null {
  if (rowIndex < 0 || rowIndex >= result.data.length) {
    return null;
  }
  if (columnIndex < 0 || columnIndex >= result.columnCount) {
    return null;
  }

  return result.data[rowIndex][columnIndex] ?? '';
}

/**
 * Get cell value by header
 * 
 * @param result - Parse result
 * @param rowIndex - Row index
 * @param headerName - Header name
 * @returns Cell value or null
 */
export function getCellByHeader(
  result: CsvParseResult,
  rowIndex: number,
  headerName: string
): string | null {
  const columnIndex = result.headers.findIndex(
    h => h.toLowerCase() === headerName.toLowerCase()
  );

  if (columnIndex === -1) {
    return null;
  }

  return getCellValue(result, rowIndex, columnIndex);
}

// ============================================================================
// SERIALIZATION
// ============================================================================

/**
 * Convert data back to CSV string
 * 
 * @param headers - Header row
 * @param data - Data rows
 * @param options - Serialization options
 * @returns CSV string
 */
export function toCsvString(
  headers: string[],
  data: string[][],
  options: {
    delimiter?: string;
    lineEnding?: string;
    quoteAll?: boolean;
  } = {}
): string {
  const delimiter = options.delimiter ?? ',';
  const lineEnding = options.lineEnding ?? '\n';
  const quoteAll = options.quoteAll ?? false;

  const formatCell = (value: string): string => {
    const needsQuotes = quoteAll || 
      value.includes(delimiter) || 
      value.includes('"') || 
      value.includes('\n') ||
      value.includes('\r');

    if (needsQuotes) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const formatRow = (row: string[]): string => {
    return row.map(formatCell).join(delimiter);
  };

  const rows = [headers, ...data];
  return rows.map(formatRow).join(lineEnding);
}

/**
 * Convert parse result back to CSV string
 */
export function resultToCsvString(
  result: CsvParseResult,
  options: Parameters<typeof toCsvString>[2] = {}
): string {
  return toCsvString(result.headers, result.data, options);
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Read File as text
 */
async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Read Blob as text
 */
async function readBlobAsText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read blob'));
    reader.readAsText(blob);
  });
}

/**
 * Escape regex special characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Create empty result with error
 */
function createEmptyResult(
  errors: CsvParseError[],
  code: string,
  message: string,
  startTime: number,
  opts: Required<CsvParseOptions>
): CsvParseResult {
  errors.push({ type: 'error', code, message });

  return {
    success: false,
    headers: [],
    data: [],
    rawData: [],
    rowCount: 0,
    columnCount: 0,
    errors,
    metadata: {
      delimiter: opts.delimiter,
      lineEnding: opts.lineEnding === 'auto' ? '\n' : opts.lineEnding,
      hasHeaders: opts.hasHeaders,
      characterCount: 0,
      parseDuration: performance.now() - startTime
    }
  };
}

/**
 * Preview CSV (first N rows)
 * 
 * @param content - CSV content
 * @param rowCount - Number of rows to preview
 * @returns Parse result limited to preview rows
 */
export function previewCsv(
  content: string,
  rowCount: number = 5
): CsvParseResult {
  return parseCsv(content, { maxRows: rowCount + 1 }); // +1 for header
}

/**
 * Count rows without full parsing
 * 
 * @param content - CSV content
 * @returns Approximate row count
 */
export function countRows(content: string): number {
  if (!content) return 0;
  
  const lineEnding = detectLineEnding(content);
  const lines = content.split(lineEnding === '\r\n' ? /\r\n/ : lineEnding === '\r' ? /\r/ : /\n/);
  
  return lines.filter(line => line.trim().length > 0).length;
}

/**
 * Check if content looks like CSV
 */
export function isCsvContent(content: string): boolean {
  if (!content || content.trim().length === 0) {
    return false;
  }

  const delimiter = detectDelimiter(content);
  if (!delimiter) {
    return false;
  }

  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 1) {
    return false;
  }

  // Check that multiple lines have same column count
  const firstLineColumns = lines[0].split(delimiter).length;
  
  if (lines.length > 1) {
    const secondLineColumns = lines[1].split(delimiter).length;
    return Math.abs(firstLineColumns - secondLineColumns) <= 1;
  }

  return firstLineColumns > 1;
}
