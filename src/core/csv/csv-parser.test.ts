/**
 * @fileoverview Tests for CSV parser
 * @module core/csv/csv-parser.test
 */

import { describe, it, expect } from 'vitest';
import {
  parseCsv,
  validateCsv,
  detectDelimiter,
  detectLineEnding,
  getRowAsObject,
  getAllRowsAsObjects,
  getColumnValues,
  getColumnByIndex,
  getCellValue,
  getCellByHeader,
  toCsvString,
  resultToCsvString,
  previewCsv,
  countRows,
  isCsvContent,
  DEFAULT_PARSE_OPTIONS,
  CSV_ERROR_CODES
} from './csv-parser';

describe('CSV Parser', () => {
  // ==========================================================================
  // CONSTANTS
  // ==========================================================================

  describe('Constants', () => {
    it('should have correct default options', () => {
      expect(DEFAULT_PARSE_OPTIONS.delimiter).toBe(',');
      expect(DEFAULT_PARSE_OPTIONS.quote).toBe('"');
      expect(DEFAULT_PARSE_OPTIONS.hasHeaders).toBe(true);
      expect(DEFAULT_PARSE_OPTIONS.skipEmptyRows).toBe(true);
      expect(DEFAULT_PARSE_OPTIONS.trimValues).toBe(true);
    });

    it('should have error codes defined', () => {
      expect(CSV_ERROR_CODES.EMPTY_FILE).toBeDefined();
      expect(CSV_ERROR_CODES.INCONSISTENT_COLUMNS).toBeDefined();
      expect(CSV_ERROR_CODES.DUPLICATE_HEADERS).toBeDefined();
    });
  });

  // ==========================================================================
  // BASIC PARSING
  // ==========================================================================

  describe('parseCsv', () => {
    it('should parse simple CSV', () => {
      const csv = `name,email,phone
John,john@example.com,555-1234
Jane,jane@example.com,555-5678`;

      const result = parseCsv(csv);

      expect(result.success).toBe(true);
      expect(result.headers).toEqual(['name', 'email', 'phone']);
      expect(result.data).toHaveLength(2);
      expect(result.rowCount).toBe(2);
      expect(result.columnCount).toBe(3);
    });

    it('should handle Windows line endings (CRLF)', () => {
      const csv = 'name,email\r\nJohn,john@example.com\r\nJane,jane@example.com';

      const result = parseCsv(csv);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.metadata.lineEnding).toBe('\r\n');
    });

    it('should handle Mac line endings (CR)', () => {
      const csv = 'name,email\rJohn,john@example.com\rJane,jane@example.com';

      const result = parseCsv(csv);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it('should handle quoted values', () => {
      const csv = `name,description
"John Doe","A person with, commas"
"Jane ""Janey"" Doe","Another ""quoted"" value"`;

      const result = parseCsv(csv);

      expect(result.success).toBe(true);
      expect(result.data[0][0]).toBe('John Doe');
      expect(result.data[0][1]).toBe('A person with, commas');
      expect(result.data[1][0]).toBe('Jane "Janey" Doe');
      expect(result.data[1][1]).toBe('Another "quoted" value');
    });

    it('should handle multiline quoted values', () => {
      const csv = `name,address
John,"123 Main St
Apt 4"`;

      const result = parseCsv(csv);

      expect(result.success).toBe(true);
      expect(result.data[0][1]).toContain('\n');
    });

    it('should handle empty content', () => {
      const result = parseCsv('');

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.code === CSV_ERROR_CODES.EMPTY_FILE)).toBe(true);
    });

    it('should handle headers only', () => {
      const csv = 'name,email,phone';

      const result = parseCsv(csv);

      expect(result.success).toBe(true);
      expect(result.headers).toEqual(['name', 'email', 'phone']);
      expect(result.data).toHaveLength(0);
      expect(result.errors.some(e => e.code === CSV_ERROR_CODES.NO_DATA_ROWS)).toBe(true);
    });

    it('should skip empty rows when configured', () => {
      const csv = `name,email
John,john@example.com

Jane,jane@example.com

`;

      const result = parseCsv(csv, { skipEmptyRows: true });

      expect(result.data).toHaveLength(2);
    });

    it('should preserve empty rows when configured', () => {
      const csv = `name,email
John,john@example.com

Jane,jane@example.com`;

      const result = parseCsv(csv, { skipEmptyRows: false });

      expect(result.data.length).toBeGreaterThan(2);
    });

    it('should trim values when configured', () => {
      const csv = `name,email
  John  ,  john@example.com  `;

      const result = parseCsv(csv, { trimValues: true });

      expect(result.data[0][0]).toBe('John');
      expect(result.data[0][1]).toBe('john@example.com');
    });

    it('should preserve whitespace when configured', () => {
      const csv = `name,email
  John  ,  john@example.com  `;

      const result = parseCsv(csv, { trimValues: false });

      expect(result.data[0][0]).toBe('  John  ');
    });

    it('should respect maxRows option', () => {
      const csv = `name
Row1
Row2
Row3
Row4
Row5`;

      const result = parseCsv(csv, { maxRows: 3 });

      expect(result.data.length).toBeLessThanOrEqual(2); // -1 for header
    });

    it('should parse without headers when configured', () => {
      const csv = `John,john@example.com
Jane,jane@example.com`;

      const result = parseCsv(csv, { hasHeaders: false });

      expect(result.headers).toEqual([]);
      expect(result.data).toHaveLength(2);
    });
  });

  // ==========================================================================
  // DELIMITERS
  // ==========================================================================

  describe('Delimiters', () => {
    it('should parse semicolon-delimited CSV', () => {
      const csv = `name;email;phone
John;john@example.com;555-1234`;

      const result = parseCsv(csv, { delimiter: ';' });

      expect(result.success).toBe(true);
      expect(result.headers).toEqual(['name', 'email', 'phone']);
    });

    it('should parse tab-delimited CSV', () => {
      const csv = `name\temail\tphone
John\tjohn@example.com\t555-1234`;

      const result = parseCsv(csv, { delimiter: '\t' });

      expect(result.success).toBe(true);
      expect(result.headers).toEqual(['name', 'email', 'phone']);
    });

    it('should auto-detect delimiter', () => {
      const csv = `name;email;phone
John;john@example.com;555-1234`;

      const detected = detectDelimiter(csv);

      expect(detected).toBe(';');
    });
  });

  // ==========================================================================
  // LINE ENDINGS
  // ==========================================================================

  describe('Line Endings', () => {
    it('should detect LF', () => {
      const content = 'line1\nline2\nline3';
      expect(detectLineEnding(content)).toBe('\n');
    });

    it('should detect CRLF', () => {
      const content = 'line1\r\nline2\r\nline3';
      expect(detectLineEnding(content)).toBe('\r\n');
    });

    it('should detect CR', () => {
      const content = 'line1\rline2\rline3';
      expect(detectLineEnding(content)).toBe('\r');
    });
  });

  // ==========================================================================
  // VALIDATION
  // ==========================================================================

  describe('validateCsv', () => {
    it('should validate correct CSV', () => {
      const csv = `name,email
John,john@example.com`;

      const result = validateCsv(csv);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect empty CSV', () => {
      const result = validateCsv('');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should warn about inconsistent columns', () => {
      const csv = `name,email,phone
John,john@example.com
Jane,jane@example.com,555-5678,extra`;

      const result = validateCsv(csv);

      expect(result.warnings.some(w => w.includes('columns'))).toBe(true);
    });

    it('should warn about duplicate headers', () => {
      const csv = `name,email,name
John,john@example.com,Johnny`;

      const result = parseCsv(csv);

      expect(result.errors.some(e => e.code === CSV_ERROR_CODES.DUPLICATE_HEADERS)).toBe(true);
    });

    it('should warn about empty headers', () => {
      const csv = `name,,phone
John,john@example.com,555-1234`;

      const result = parseCsv(csv);

      expect(result.errors.some(e => e.code === CSV_ERROR_CODES.EMPTY_HEADER)).toBe(true);
    });
  });

  // ==========================================================================
  // DATA ACCESS
  // ==========================================================================

  describe('Data Access', () => {
    const csv = `name,email,phone
John,john@example.com,555-1234
Jane,jane@example.com,555-5678`;

    describe('getRowAsObject', () => {
      it('should return row as object', () => {
        const result = parseCsv(csv);
        const row = getRowAsObject(result, 0);

        expect(row).toEqual({
          name: 'John',
          email: 'john@example.com',
          phone: '555-1234'
        });
      });

      it('should return null for invalid index', () => {
        const result = parseCsv(csv);
        const row = getRowAsObject(result, 99);

        expect(row).toBeNull();
      });
    });

    describe('getAllRowsAsObjects', () => {
      it('should return all rows as objects', () => {
        const result = parseCsv(csv);
        const rows = getAllRowsAsObjects(result);

        expect(rows).toHaveLength(2);
        expect(rows[0].name).toBe('John');
        expect(rows[1].name).toBe('Jane');
      });
    });

    describe('getColumnValues', () => {
      it('should return column values by header', () => {
        const result = parseCsv(csv);
        const names = getColumnValues(result, 'name');

        expect(names).toEqual(['John', 'Jane']);
      });

      it('should be case-insensitive', () => {
        const result = parseCsv(csv);
        const names = getColumnValues(result, 'NAME');

        expect(names).toEqual(['John', 'Jane']);
      });

      it('should return empty array for unknown header', () => {
        const result = parseCsv(csv);
        const values = getColumnValues(result, 'unknown');

        expect(values).toEqual([]);
      });
    });

    describe('getColumnByIndex', () => {
      it('should return column values by index', () => {
        const result = parseCsv(csv);
        const emails = getColumnByIndex(result, 1);

        expect(emails).toEqual(['john@example.com', 'jane@example.com']);
      });

      it('should return empty array for invalid index', () => {
        const result = parseCsv(csv);
        const values = getColumnByIndex(result, 99);

        expect(values).toEqual([]);
      });
    });

    describe('getCellValue', () => {
      it('should return cell value', () => {
        const result = parseCsv(csv);
        const value = getCellValue(result, 0, 1);

        expect(value).toBe('john@example.com');
      });

      it('should return null for invalid indices', () => {
        const result = parseCsv(csv);

        expect(getCellValue(result, -1, 0)).toBeNull();
        expect(getCellValue(result, 0, -1)).toBeNull();
        expect(getCellValue(result, 99, 0)).toBeNull();
      });
    });

    describe('getCellByHeader', () => {
      it('should return cell value by header', () => {
        const result = parseCsv(csv);
        const value = getCellByHeader(result, 0, 'email');

        expect(value).toBe('john@example.com');
      });

      it('should return null for unknown header', () => {
        const result = parseCsv(csv);
        const value = getCellByHeader(result, 0, 'unknown');

        expect(value).toBeNull();
      });
    });
  });

  // ==========================================================================
  // SERIALIZATION
  // ==========================================================================

  describe('Serialization', () => {
    describe('toCsvString', () => {
      it('should convert to CSV string', () => {
        const headers = ['name', 'email'];
        const data = [
          ['John', 'john@example.com'],
          ['Jane', 'jane@example.com']
        ];

        const csv = toCsvString(headers, data);

        expect(csv).toContain('name,email');
        expect(csv).toContain('John,john@example.com');
      });

      it('should quote values with delimiters', () => {
        const headers = ['name', 'description'];
        const data = [['John', 'Hello, World']];

        const csv = toCsvString(headers, data);

        expect(csv).toContain('"Hello, World"');
      });

      it('should escape quotes', () => {
        const headers = ['name', 'quote'];
        const data = [['John', 'He said "Hello"']];

        const csv = toCsvString(headers, data);

        expect(csv).toContain('""Hello""');
      });

      it('should use custom delimiter', () => {
        const headers = ['name', 'email'];
        const data = [['John', 'john@example.com']];

        const csv = toCsvString(headers, data, { delimiter: ';' });

        expect(csv).toContain('name;email');
      });
    });

    describe('resultToCsvString', () => {
      it('should convert parse result back to CSV', () => {
        const originalCsv = `name,email
John,john@example.com
Jane,jane@example.com`;

        const result = parseCsv(originalCsv);
        const newCsv = resultToCsvString(result);

        expect(newCsv).toContain('name,email');
        expect(newCsv).toContain('John,john@example.com');
      });
    });
  });

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  describe('Utilities', () => {
    describe('previewCsv', () => {
      it('should return limited rows', () => {
        const csv = `name
Row1
Row2
Row3
Row4
Row5
Row6
Row7`;

        const result = previewCsv(csv, 3);

        expect(result.data.length).toBeLessThanOrEqual(3);
      });
    });

    describe('countRows', () => {
      it('should count non-empty rows', () => {
        const csv = `header
Row1
Row2

Row3`;

        expect(countRows(csv)).toBe(4); // header + 3 data rows
      });

      it('should return 0 for empty content', () => {
        expect(countRows('')).toBe(0);
      });
    });

    describe('isCsvContent', () => {
      it('should return true for valid CSV', () => {
        const csv = `name,email,phone
John,john@example.com,555-1234`;

        expect(isCsvContent(csv)).toBe(true);
      });

      it('should return false for empty content', () => {
        expect(isCsvContent('')).toBe(false);
      });

      it('should return false for single column', () => {
        const content = 'single\ncolumn\nonly';
        expect(isCsvContent(content)).toBe(false);
      });
    });
  });

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle single cell', () => {
      const result = parseCsv('value', { hasHeaders: false });

      expect(result.data[0][0]).toBe('value');
    });

    it('should handle trailing delimiter', () => {
      const csv = `name,email,
John,john@example.com,`;

      const result = parseCsv(csv);

      expect(result.columnCount).toBe(3);
    });

    it('should handle unicode content', () => {
      const csv = `name,greeting
John,こんにちは
José,¡Hola!`;

      const result = parseCsv(csv);

      expect(result.data[0][1]).toBe('こんにちは');
      expect(result.data[1][0]).toBe('José');
    });

    it('should handle very long values', () => {
      const longValue = 'x'.repeat(10000);
      const csv = `name,data
John,${longValue}`;

      const result = parseCsv(csv);

      expect(result.data[0][1].length).toBe(10000);
    });
  });
});
