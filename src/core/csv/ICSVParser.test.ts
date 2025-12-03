/**
 * Tests for ICSVParser types and helpers
 * @module core/csv/ICSVParser.test
 */

import { describe, it, expect } from 'vitest';
import {
  // Types
  type CSVData,
  type ParseResult,
  type FieldMapping,
  type AutoMapResult,
  type ValidationResult,
  type NormalizationConfig,
  
  // Constants
  SUPPORTED_EXTENSIONS,
  SUPPORTED_MIME_TYPES,
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
// CONSTANTS TESTS
// ============================================================================

describe('Constants', () => {
  describe('SUPPORTED_EXTENSIONS', () => {
    it('should include csv', () => {
      expect(SUPPORTED_EXTENSIONS).toContain('.csv');
    });
    
    it('should include xlsx', () => {
      expect(SUPPORTED_EXTENSIONS).toContain('.xlsx');
    });
    
    it('should include xls', () => {
      expect(SUPPORTED_EXTENSIONS).toContain('.xls');
    });
    
    it('should include tsv', () => {
      expect(SUPPORTED_EXTENSIONS).toContain('.tsv');
    });
  });
  
  describe('SUPPORTED_MIME_TYPES', () => {
    it('should map text/csv to csv', () => {
      expect(SUPPORTED_MIME_TYPES['text/csv']).toBe('csv');
    });
    
    it('should map xlsx MIME type', () => {
      expect(SUPPORTED_MIME_TYPES[
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ]).toBe('xlsx');
    });
  });
  
  describe('DEFAULT_PARSER_CONFIG', () => {
    it('should have 0.3 similarity threshold', () => {
      expect(DEFAULT_PARSER_CONFIG.similarityThreshold).toBe(0.3);
    });
    
    it('should have 10 preview rows', () => {
      expect(DEFAULT_PARSER_CONFIG.previewRowCount).toBe(10);
    });
    
    it('should trim values by default', () => {
      expect(DEFAULT_PARSER_CONFIG.trimValues).toBe(true);
    });
    
    it('should skip empty rows by default', () => {
      expect(DEFAULT_PARSER_CONFIG.skipEmptyRows).toBe(true);
    });
    
    it('should use utf-8 encoding', () => {
      expect(DEFAULT_PARSER_CONFIG.encoding).toBe('utf-8');
    });
  });
  
  describe('DEFAULT_NORMALIZATION_CONFIG', () => {
    it('should lowercase by default', () => {
      expect(DEFAULT_NORMALIZATION_CONFIG.lowercase).toBe(true);
    });
    
    it('should remove spaces by default', () => {
      expect(DEFAULT_NORMALIZATION_CONFIG.removeSpaces).toBe(true);
    });
    
    it('should remove underscores by default', () => {
      expect(DEFAULT_NORMALIZATION_CONFIG.removeUnderscores).toBe(true);
    });
    
    it('should remove hyphens by default', () => {
      expect(DEFAULT_NORMALIZATION_CONFIG.removeHyphens).toBe(true);
    });
    
    it('should not remove special chars by default', () => {
      expect(DEFAULT_NORMALIZATION_CONFIG.removeSpecialChars).toBe(false);
    });
  });
});

// ============================================================================
// FILE TYPE DETECTION TESTS
// ============================================================================

describe('File Type Detection', () => {
  describe('getFileExtension', () => {
    it('should extract csv extension', () => {
      expect(getFileExtension('data.csv')).toBe('.csv');
    });
    
    it('should extract xlsx extension', () => {
      expect(getFileExtension('report.xlsx')).toBe('.xlsx');
    });
    
    it('should handle no extension', () => {
      expect(getFileExtension('filename')).toBe('');
    });
    
    it('should handle multiple dots', () => {
      expect(getFileExtension('data.backup.csv')).toBe('.csv');
    });
    
    it('should lowercase extension', () => {
      expect(getFileExtension('DATA.CSV')).toBe('.csv');
    });
  });
  
  describe('getTypeByExtension', () => {
    it('should return csv for .csv', () => {
      expect(getTypeByExtension('.csv')).toBe('csv');
    });
    
    it('should return xlsx for .xlsx', () => {
      expect(getTypeByExtension('.xlsx')).toBe('xlsx');
    });
    
    it('should return xls for .xls', () => {
      expect(getTypeByExtension('.xls')).toBe('xls');
    });
    
    it('should return tsv for .tsv', () => {
      expect(getTypeByExtension('.tsv')).toBe('tsv');
    });
    
    it('should return unknown for unsupported', () => {
      expect(getTypeByExtension('.pdf')).toBe('unknown');
    });
    
    it('should handle uppercase', () => {
      expect(getTypeByExtension('.CSV')).toBe('csv');
    });
  });
  
  describe('detectFileType', () => {
    it('should detect csv by MIME type', () => {
      const file = new File([''], 'data.csv', { type: 'text/csv' });
      const result = detectFileType(file);
      
      expect(result.type).toBe('csv');
      expect(result.supported).toBe(true);
    });
    
    it('should fall back to extension', () => {
      const file = new File([''], 'data.xlsx', { type: '' });
      const result = detectFileType(file);
      
      expect(result.type).toBe('xlsx');
      expect(result.supported).toBe(true);
    });
    
    it('should return unknown for unsupported', () => {
      const file = new File([''], 'image.png', { type: 'image/png' });
      const result = detectFileType(file);
      
      expect(result.type).toBe('unknown');
      expect(result.supported).toBe(false);
    });
  });
  
  describe('isSupportedFile', () => {
    it('should return true for csv', () => {
      const file = new File([''], 'data.csv', { type: 'text/csv' });
      expect(isSupportedFile(file)).toBe(true);
    });
    
    it('should return false for unsupported', () => {
      const file = new File([''], 'image.png', { type: 'image/png' });
      expect(isSupportedFile(file)).toBe(false);
    });
  });
});

// ============================================================================
// NORMALIZATION TESTS
// ============================================================================

describe('normalizeString', () => {
  it('should lowercase', () => {
    expect(normalizeString('Hello World')).toBe('helloworld');
  });
  
  it('should remove spaces', () => {
    expect(normalizeString('first name')).toBe('firstname');
  });
  
  it('should remove underscores', () => {
    expect(normalizeString('first_name')).toBe('firstname');
  });
  
  it('should remove hyphens', () => {
    expect(normalizeString('first-name')).toBe('firstname');
  });
  
  it('should handle combined normalization', () => {
    expect(normalizeString('First_Name Field')).toBe('firstnamefield');
  });
  
  it('should respect config options', () => {
    const config: NormalizationConfig = {
      lowercase: false,
      removeSpaces: false,
      removeUnderscores: false,
      removeHyphens: false,
      removeSpecialChars: false,
    };
    
    expect(normalizeString('First_Name', config)).toBe('First_Name');
  });
  
  it('should remove special chars when configured', () => {
    const config: NormalizationConfig = {
      ...DEFAULT_NORMALIZATION_CONFIG,
      removeSpecialChars: true,
    };
    
    expect(normalizeString('email@domain.com', config)).toBe('emaildomaincom');
  });
});

// ============================================================================
// SIMILARITY TESTS
// ============================================================================

describe('diceSimilarity', () => {
  it('should return 1 for identical strings', () => {
    expect(diceSimilarity('hello', 'hello')).toBe(1);
  });
  
  it('should return 0 for completely different strings', () => {
    expect(diceSimilarity('abc', 'xyz')).toBe(0);
  });
  
  it('should return value between 0 and 1 for similar strings', () => {
    const score = diceSimilarity('firstname', 'first_name');
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });
  
  it('should handle short strings', () => {
    expect(diceSimilarity('a', 'b')).toBe(0);
  });
  
  it('should be case sensitive', () => {
    const sameCaseScore = diceSimilarity('hello', 'hello');
    const diffCaseScore = diceSimilarity('hello', 'HELLO');
    
    expect(sameCaseScore).toBe(1);
    expect(diffCaseScore).toBeLessThan(1);
  });
  
  it('should give high score for similar strings', () => {
    // After normalization: 'username' vs 'username'
    const normalized1 = normalizeString('User Name');
    const normalized2 = normalizeString('user_name');
    
    expect(diceSimilarity(normalized1, normalized2)).toBe(1);
  });
});

// ============================================================================
// FACTORY FUNCTION TESTS
// ============================================================================

describe('Factory Functions', () => {
  describe('createEmptyCSVData', () => {
    it('should create empty structure', () => {
      const data = createEmptyCSVData();
      
      expect(data.headers).toEqual([]);
      expect(data.rows).toEqual([]);
      expect(data.rowCount).toBe(0);
      expect(data.columnCount).toBe(0);
      expect(data.fileType).toBe('csv');
      expect(data.parsedAt).toBeGreaterThan(0);
    });
  });
  
  describe('createParseError', () => {
    it('should create error with all fields', () => {
      const error = createParseError(
        'parse_error',
        'Invalid format',
        5,
        'Email'
      );
      
      expect(error.type).toBe('parse_error');
      expect(error.message).toBe('Invalid format');
      expect(error.row).toBe(5);
      expect(error.column).toBe('Email');
    });
    
    it('should create error without optional fields', () => {
      const error = createParseError('empty_file', 'File is empty');
      
      expect(error.type).toBe('empty_file');
      expect(error.row).toBeUndefined();
      expect(error.column).toBeUndefined();
    });
  });
  
  describe('createValidationError', () => {
    it('should create validation error', () => {
      const error = createValidationError(
        'duplicate_mapping',
        'Column mapped twice',
        'Email',
        [1, 5, 10]
      );
      
      expect(error.type).toBe('duplicate_mapping');
      expect(error.column).toBe('Email');
      expect(error.rows).toEqual([1, 5, 10]);
    });
  });
  
  describe('createFieldMapping', () => {
    it('should create unmapped field', () => {
      const mapping = createFieldMapping('Email');
      
      expect(mapping.csvColumn).toBe('Email');
      expect(mapping.stepLabel).toBeNull();
      expect(mapping.mapped).toBe(false);
      expect(mapping.autoMapped).toBe(false);
    });
    
    it('should create mapped field', () => {
      const mapping = createFieldMapping('Email', 'Email Address', {
        stepIndex: 2,
        confidence: 0.85,
        autoMapped: true,
      });
      
      expect(mapping.csvColumn).toBe('Email');
      expect(mapping.stepLabel).toBe('Email Address');
      expect(mapping.mapped).toBe(true);
      expect(mapping.stepIndex).toBe(2);
      expect(mapping.confidence).toBe(0.85);
      expect(mapping.autoMapped).toBe(true);
    });
  });
  
  describe('calculateMappingStats', () => {
    it('should calculate stats for mappings', () => {
      const mappings: FieldMapping[] = [
        createFieldMapping('Email', 'Email Address', { confidence: 0.9, autoMapped: true }),
        createFieldMapping('Name', 'Full Name', { confidence: 0.8, autoMapped: true }),
        createFieldMapping('Phone', null),
      ];
      
      const stats = calculateMappingStats(mappings);
      
      expect(stats.totalColumns).toBe(3);
      expect(stats.mappedCount).toBe(2);
      expect(stats.unmappedCount).toBe(1);
      expect(stats.avgConfidence).toBeCloseTo(0.85, 2);
    });
    
    it('should handle empty mappings', () => {
      const stats = calculateMappingStats([]);
      
      expect(stats.totalColumns).toBe(0);
      expect(stats.mappedCount).toBe(0);
      expect(stats.avgConfidence).toBe(0);
    });
    
    it('should handle all unmapped', () => {
      const mappings: FieldMapping[] = [
        createFieldMapping('Col1'),
        createFieldMapping('Col2'),
      ];
      
      const stats = calculateMappingStats(mappings);
      
      expect(stats.mappedCount).toBe(0);
      expect(stats.unmappedCount).toBe(2);
      expect(stats.avgConfidence).toBe(0);
    });
  });
});

// ============================================================================
// TYPE VALIDATION TESTS
// ============================================================================

describe('Type Definitions', () => {
  describe('CSVData', () => {
    it('should accept valid structure', () => {
      const data: CSVData = {
        headers: ['Name', 'Email'],
        rows: [
          { Name: 'John', Email: 'john@example.com' },
          { Name: 'Jane', Email: 'jane@example.com' },
        ],
        rowCount: 2,
        columnCount: 2,
        fileType: 'csv',
        parsedAt: Date.now(),
      };
      
      expect(data.headers).toHaveLength(2);
      expect(data.rows).toHaveLength(2);
    });
  });
  
  describe('ParseResult', () => {
    it('should accept success result', () => {
      const result: ParseResult = {
        success: true,
        data: createEmptyCSVData(),
      };
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
    
    it('should accept error result', () => {
      const result: ParseResult = {
        success: false,
        errors: [createParseError('empty_file', 'Empty')],
      };
      
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });
  
  describe('ValidationResult', () => {
    it('should accept valid result', () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
        stats: {
          totalRows: 10,
          completeRows: 10,
          incompleteRows: 0,
          mappedColumns: 5,
          unmappedColumns: 0,
          emptyCells: 0,
        },
      };
      
      expect(result.valid).toBe(true);
      expect(result.stats.totalRows).toBe(10);
    });
  });
  
  describe('AutoMapResult', () => {
    it('should accept mapping result', () => {
      const result: AutoMapResult = {
        mappings: [createFieldMapping('Email', 'Email Address')],
        suggestions: [],
        unmapped: ['Phone'],
        stats: {
          totalColumns: 2,
          mappedCount: 1,
          unmappedCount: 1,
          avgConfidence: 0.9,
        },
      };
      
      expect(result.mappings).toHaveLength(1);
      expect(result.unmapped).toContain('Phone');
    });
  });
});
