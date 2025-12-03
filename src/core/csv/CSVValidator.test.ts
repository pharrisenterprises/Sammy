/**
 * Tests for CSVValidator
 * @module core/csv/CSVValidator.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  CSVValidator,
  createCSVValidator,
  createStrictValidator,
  createLenientValidator,
  createPreviewValidator,
  getCSVValidator,
  resetCSVValidator,
  isValidCSVData,
  hasValidMappings,
  getValidationSummary,
  DEFAULT_VALIDATOR_CONFIG,
} from './CSVValidator';
import type { CSVData, FieldMapping } from './ICSVParser';
import { createFieldMapping, createEmptyCSVData } from './ICSVParser';

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Create test CSV data
 */
function createTestCSVData(options?: {
  headers?: string[];
  rows?: Record<string, string>[];
}): CSVData {
  const headers = options?.headers ?? ['Name', 'Email', 'Phone'];
  const rows = options?.rows ?? [
    { Name: 'John', Email: 'john@example.com', Phone: '555-1234' },
    { Name: 'Jane', Email: 'jane@example.com', Phone: '555-5678' },
  ];
  
  return {
    headers,
    rows,
    rowCount: rows.length,
    columnCount: headers.length,
    fileType: 'csv',
    parsedAt: Date.now(),
  };
}

/**
 * Create test mappings
 */
function createTestMappings(
  mapped: Array<{ column: string; label: string; stepIndex: number }>,
  unmapped: string[] = []
): FieldMapping[] {
  const mappings: FieldMapping[] = [];
  
  for (const m of mapped) {
    mappings.push(createFieldMapping(m.column, m.label, {
      stepIndex: m.stepIndex,
      confidence: 0.9,
      autoMapped: true,
    }));
  }
  
  for (const column of unmapped) {
    mappings.push(createFieldMapping(column));
  }
  
  return mappings;
}

// ============================================================================
// TESTS
// ============================================================================

describe('CSVValidator', () => {
  let validator: CSVValidator;
  
  beforeEach(() => {
    validator = createCSVValidator();
  });
  
  afterEach(() => {
    resetCSVValidator();
  });
  
  // ==========================================================================
  // CONFIGURATION TESTS
  // ==========================================================================
  
  describe('configuration', () => {
    it('should use default config', () => {
      const config = validator.getConfig();
      
      expect(config.requireMapping).toBe(DEFAULT_VALIDATOR_CONFIG.requireMapping);
      expect(config.minMappedFields).toBe(DEFAULT_VALIDATOR_CONFIG.minMappedFields);
    });
    
    it('should accept custom config', () => {
      const customValidator = createCSVValidator({
        minMappedFields: 3,
        allowDuplicateMappings: true,
      });
      
      const config = customValidator.getConfig();
      
      expect(config.minMappedFields).toBe(3);
      expect(config.allowDuplicateMappings).toBe(true);
    });
    
    it('should update config', () => {
      validator.setConfig({ requireAllColumnsMapped: true });
      
      expect(validator.getConfig().requireAllColumnsMapped).toBe(true);
    });
  });
  
  // ==========================================================================
  // DATA VALIDATION TESTS
  // ==========================================================================
  
  describe('validateData', () => {
    it('should pass for valid data', () => {
      const data = createTestCSVData();
      
      const result = validator.validateData(data);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should fail for empty data', () => {
      const data = createEmptyCSVData();
      
      const result = validator.validateData(data);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'empty_data')).toBe(true);
    });
    
    it('should fail for data with no headers', () => {
      const data = createTestCSVData({ headers: [], rows: [] });
      
      const result = validator.validateData(data);
      
      expect(result.valid).toBe(false);
    });
    
    it('should warn about empty cells', () => {
      const data = createTestCSVData({
        rows: [
          { Name: 'John', Email: '', Phone: '555-1234' },
          { Name: '', Email: 'jane@example.com', Phone: '' },
        ],
      });
      
      const result = validator.validateData(data);
      
      expect(result.warnings.some(w => w.type === 'empty_cells')).toBe(true);
    });
    
    it('should fail for too many empty cells', () => {
      const strictValidator = createCSVValidator({ maxEmptyCellRatio: 0.1 });
      const data = createTestCSVData({
        rows: [
          { Name: '', Email: '', Phone: '' },
          { Name: '', Email: '', Phone: '' },
        ],
      });
      
      const result = strictValidator.validateData(data);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'invalid_value')).toBe(true);
    });
    
    it('should calculate correct statistics', () => {
      const data = createTestCSVData({
        rows: [
          { Name: 'John', Email: 'john@example.com', Phone: '555-1234' },
          { Name: 'Jane', Email: '', Phone: '555-5678' },
        ],
      });
      
      const result = validator.validateData(data);
      
      expect(result.stats.totalRows).toBe(2);
      expect(result.stats.completeRows).toBe(1);
      expect(result.stats.incompleteRows).toBe(1);
      expect(result.stats.emptyCells).toBe(1);
    });
    
    it('should not warn about empty cells when disabled', () => {
      const lenientValidator = createCSVValidator({ warnOnEmptyCells: false });
      const data = createTestCSVData({
        rows: [{ Name: '', Email: '', Phone: '' }],
      });
      
      const result = lenientValidator.validateData(data);
      
      expect(result.warnings.filter(w => w.type === 'empty_cells')).toHaveLength(0);
    });
  });
  
  // ==========================================================================
  // MAPPING VALIDATION TESTS
  // ==========================================================================
  
  describe('validateMappings', () => {
    it('should pass for valid mappings', () => {
      const data = createTestCSVData();
      const mappings = createTestMappings([
        { column: 'Name', label: 'Full Name', stepIndex: 0 },
        { column: 'Email', label: 'Email Address', stepIndex: 1 },
      ], ['Phone']);
      
      const result = validator.validateMappings(mappings, data);
      
      expect(result.valid).toBe(true);
    });
    
    it('should fail when no mappings required but none provided', () => {
      const data = createTestCSVData();
      const mappings: FieldMapping[] = [];
      
      const result = validator.validateMappings(mappings, data);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'no_mappings')).toBe(true);
    });
    
    it('should pass when no mappings required and config allows', () => {
      const lenientValidator = createCSVValidator({ requireMapping: false });
      const data = createTestCSVData();
      const mappings: FieldMapping[] = [];
      
      const result = lenientValidator.validateMappings(mappings, data);
      
      expect(result.valid).toBe(true);
    });
    
    it('should fail when minimum mapped fields not met', () => {
      const strictValidator = createCSVValidator({ minMappedFields: 2 });
      const data = createTestCSVData();
      const mappings = createTestMappings([
        { column: 'Name', label: 'Full Name', stepIndex: 0 },
      ]);
      
      const result = strictValidator.validateMappings(mappings, data);
      
      expect(result.valid).toBe(false);
    });
    
    it('should fail for duplicate mappings by default', () => {
      const data = createTestCSVData();
      const mappings = createTestMappings([
        { column: 'Name', label: 'Full Name', stepIndex: 0 },
        { column: 'Email', label: 'Email', stepIndex: 0 }, // Same stepIndex
      ]);
      
      const result = validator.validateMappings(mappings, data);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'duplicate_mapping')).toBe(true);
    });
    
    it('should allow duplicate mappings when configured', () => {
      const duplicateValidator = createCSVValidator({ allowDuplicateMappings: true });
      const data = createTestCSVData();
      const mappings = createTestMappings([
        { column: 'Name', label: 'Full Name', stepIndex: 0 },
        { column: 'Email', label: 'Email', stepIndex: 0 },
      ]);
      
      const result = duplicateValidator.validateMappings(mappings, data);
      
      expect(result.errors.filter(e => e.type === 'duplicate_mapping')).toHaveLength(0);
    });
    
    it('should warn about unmapped columns', () => {
      const data = createTestCSVData();
      const mappings = createTestMappings([
        { column: 'Name', label: 'Full Name', stepIndex: 0 },
      ], ['Email', 'Phone']);
      
      const result = validator.validateMappings(mappings, data);
      
      expect(result.warnings.some(w => w.type === 'unmapped_columns')).toBe(true);
    });
    
    it('should fail when all columns must be mapped', () => {
      const strictValidator = createCSVValidator({ requireAllColumnsMapped: true });
      const data = createTestCSVData();
      const mappings = createTestMappings([
        { column: 'Name', label: 'Full Name', stepIndex: 0 },
      ], ['Email', 'Phone']);
      
      const result = strictValidator.validateMappings(mappings, data);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'missing_required')).toBe(true);
    });
    
    it('should warn about low confidence mappings', () => {
      const data = createTestCSVData();
      const mappings: FieldMapping[] = [
        createFieldMapping('Name', 'Full Name', {
          stepIndex: 0,
          confidence: 0.2, // Below threshold
          autoMapped: true,
        }),
      ];
      
      const result = validator.validateMappings(mappings, data);
      
      expect(result.warnings.some(w => w.type === 'low_confidence')).toBe(true);
    });
    
    it('should calculate mapping statistics', () => {
      const data = createTestCSVData();
      const mappings = createTestMappings([
        { column: 'Name', label: 'Full Name', stepIndex: 0 },
      ], ['Email', 'Phone']);
      
      const result = validator.validateMappings(mappings, data);
      
      expect(result.stats.mappedColumns).toBe(1);
      expect(result.stats.unmappedColumns).toBe(2);
    });
  });
  
  // ==========================================================================
  // COMBINED VALIDATION TESTS
  // ==========================================================================
  
  describe('validate', () => {
    it('should validate both data and mappings', () => {
      const data = createTestCSVData();
      const mappings = createTestMappings([
        { column: 'Name', label: 'Full Name', stepIndex: 0 },
      ]);
      
      const result = validator.validate(data, mappings);
      
      expect(result.valid).toBe(true);
    });
    
    it('should fail early on empty data', () => {
      const data = createEmptyCSVData();
      const mappings = createTestMappings([
        { column: 'Name', label: 'Full Name', stepIndex: 0 },
      ]);
      
      const result = validator.validate(data, mappings);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'empty_data')).toBe(true);
    });
    
    it('should combine errors from both validations', () => {
      const data = createTestCSVData({
        rows: [{ Name: '', Email: '', Phone: '' }],
      });
      const strictValidator = createCSVValidator({ 
        maxEmptyCellRatio: 0.1,
        minMappedFields: 2,
      });
      const mappings = createTestMappings([
        { column: 'Name', label: 'Full Name', stepIndex: 0 },
      ]);
      
      const result = strictValidator.validate(data, mappings);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
    
    it('should combine warnings from both validations', () => {
      const data = createTestCSVData({
        rows: [
          { Name: 'John', Email: '', Phone: '555-1234' },
        ],
      });
      const mappings = createTestMappings([
        { column: 'Name', label: 'Full Name', stepIndex: 0 },
      ], ['Email', 'Phone']);
      
      const result = validator.validate(data, mappings);
      
      // Should have both empty cell and unmapped column warnings
      expect(result.warnings.length).toBeGreaterThanOrEqual(1);
    });
  });
  
  // ==========================================================================
  // UTILITY TESTS
  // ==========================================================================
  
  describe('hasDuplicateMappings', () => {
    it('should return false for unique mappings', () => {
      const mappings = createTestMappings([
        { column: 'Name', label: 'Full Name', stepIndex: 0 },
        { column: 'Email', label: 'Email', stepIndex: 1 },
      ]);
      
      expect(validator.hasDuplicateMappings(mappings)).toBe(false);
    });
    
    it('should return true for duplicate step indices', () => {
      const mappings = createTestMappings([
        { column: 'Name', label: 'Full Name', stepIndex: 0 },
        { column: 'Email', label: 'Email', stepIndex: 0 },
      ]);
      
      expect(validator.hasDuplicateMappings(mappings)).toBe(true);
    });
    
    it('should ignore unmapped fields', () => {
      const mappings = createTestMappings([
        { column: 'Name', label: 'Full Name', stepIndex: 0 },
      ], ['Email', 'Phone']);
      
      expect(validator.hasDuplicateMappings(mappings)).toBe(false);
    });
  });
  
  describe('getEmptyCells', () => {
    it('should return empty cell locations', () => {
      const data = createTestCSVData({
        rows: [
          { Name: 'John', Email: '', Phone: '555-1234' },
          { Name: '', Email: 'jane@example.com', Phone: '' },
        ],
      });
      
      const emptyCells = validator.getEmptyCells(data);
      
      expect(emptyCells).toHaveLength(3);
      expect(emptyCells).toContainEqual({ row: 1, column: 'Email' });
      expect(emptyCells).toContainEqual({ row: 2, column: 'Name' });
      expect(emptyCells).toContainEqual({ row: 2, column: 'Phone' });
    });
    
    it('should return empty array for complete data', () => {
      const data = createTestCSVData();
      
      const emptyCells = validator.getEmptyCells(data);
      
      expect(emptyCells).toHaveLength(0);
    });
  });
  
  describe('getIncompleteRowIndices', () => {
    it('should return indices of incomplete rows', () => {
      const data = createTestCSVData({
        rows: [
          { Name: 'John', Email: 'john@example.com', Phone: '555-1234' },
          { Name: '', Email: 'jane@example.com', Phone: '555-5678' },
          { Name: 'Bob', Email: 'bob@example.com', Phone: '' },
        ],
      });
      
      const indices = validator.getIncompleteRowIndices(data);
      
      expect(indices).toEqual([2, 3]); // 1-indexed
    });
  });
  
  describe('getColumnsWithEmptyValues', () => {
    it('should return columns with empty values', () => {
      const data = createTestCSVData({
        rows: [
          { Name: '', Email: 'john@example.com', Phone: '555-1234' },
          { Name: 'Jane', Email: '', Phone: '555-5678' },
        ],
      });
      
      const columns = validator.getColumnsWithEmptyValues(data);
      
      expect(columns).toContain('Name');
      expect(columns).toContain('Email');
      expect(columns).not.toContain('Phone');
    });
  });
  
  describe('getEmptyRows', () => {
    it('should return indices of fully empty rows', () => {
      const data = createTestCSVData({
        rows: [
          { Name: 'John', Email: 'john@example.com', Phone: '555-1234' },
          { Name: '', Email: '', Phone: '' },
          { Name: 'Jane', Email: 'jane@example.com', Phone: '' },
        ],
      });
      
      const emptyRows = validator.getEmptyRows(data);
      
      expect(emptyRows).toEqual([2]); // Only row 2 is fully empty
    });
  });
  
  describe('calculateStats', () => {
    it('should calculate complete statistics', () => {
      const data = createTestCSVData({
        rows: [
          { Name: 'John', Email: 'john@example.com', Phone: '555-1234' },
          { Name: 'Jane', Email: '', Phone: '555-5678' },
        ],
      });
      const mappings = createTestMappings([
        { column: 'Name', label: 'Full Name', stepIndex: 0 },
      ], ['Email', 'Phone']);
      
      const stats = validator.calculateStats(data, mappings);
      
      expect(stats.totalRows).toBe(2);
      expect(stats.completeRows).toBe(1);
      expect(stats.incompleteRows).toBe(1);
      expect(stats.mappedColumns).toBe(1);
      expect(stats.unmappedColumns).toBe(2);
      expect(stats.emptyCells).toBe(1);
    });
  });
});

// ============================================================================
// FACTORY TESTS
// ============================================================================

describe('Factory Functions', () => {
  afterEach(() => {
    resetCSVValidator();
  });
  
  describe('createCSVValidator', () => {
    it('should create validator with defaults', () => {
      const validator = createCSVValidator();
      
      expect(validator).toBeInstanceOf(CSVValidator);
    });
  });
  
  describe('createStrictValidator', () => {
    it('should require all columns mapped', () => {
      const validator = createStrictValidator();
      
      expect(validator.getConfig().requireAllColumnsMapped).toBe(true);
      expect(validator.getConfig().maxEmptyCellRatio).toBe(0.1);
    });
  });
  
  describe('createLenientValidator', () => {
    it('should allow everything', () => {
      const validator = createLenientValidator();
      
      expect(validator.getConfig().requireMapping).toBe(false);
      expect(validator.getConfig().warnOnEmptyCells).toBe(false);
      expect(validator.getConfig().allowDuplicateMappings).toBe(true);
    });
  });
  
  describe('createPreviewValidator', () => {
    it('should be minimal', () => {
      const validator = createPreviewValidator();
      
      expect(validator.getConfig().requireMapping).toBe(false);
    });
  });
});

// ============================================================================
// SINGLETON TESTS
// ============================================================================

describe('Singleton', () => {
  afterEach(() => {
    resetCSVValidator();
  });
  
  describe('getCSVValidator', () => {
    it('should return same instance', () => {
      const validator1 = getCSVValidator();
      const validator2 = getCSVValidator();
      
      expect(validator1).toBe(validator2);
    });
  });
  
  describe('resetCSVValidator', () => {
    it('should create new instance after reset', () => {
      const validator1 = getCSVValidator();
      resetCSVValidator();
      const validator2 = getCSVValidator();
      
      expect(validator1).not.toBe(validator2);
    });
  });
});

// ============================================================================
// CONVENIENCE FUNCTION TESTS
// ============================================================================

describe('Convenience Functions', () => {
  describe('isValidCSVData', () => {
    it('should return true for valid data', () => {
      const data = createTestCSVData();
      
      expect(isValidCSVData(data)).toBe(true);
    });
    
    it('should return false for empty data', () => {
      const data = createEmptyCSVData();
      
      expect(isValidCSVData(data)).toBe(false);
    });
  });
  
  describe('hasValidMappings', () => {
    it('should return true for valid mappings', () => {
      const data = createTestCSVData();
      const mappings = createTestMappings([
        { column: 'Name', label: 'Full Name', stepIndex: 0 },
      ]);
      
      expect(hasValidMappings(mappings, data)).toBe(true);
    });
    
    it('should return false for no mappings', () => {
      const data = createTestCSVData();
      
      expect(hasValidMappings([], data)).toBe(false);
    });
  });
  
  describe('getValidationSummary', () => {
    it('should return success message', () => {
      const result = {
        valid: true,
        errors: [],
        warnings: [],
        stats: {
          totalRows: 10,
          completeRows: 10,
          incompleteRows: 0,
          mappedColumns: 3,
          unmappedColumns: 0,
          emptyCells: 0,
        },
      };
      
      expect(getValidationSummary(result)).toBe('Validation passed');
    });
    
    it('should include warning count', () => {
      const result = {
        valid: true,
        errors: [],
        warnings: [{ type: 'empty_cells' as const, message: 'test' }],
        stats: {
          totalRows: 10,
          completeRows: 9,
          incompleteRows: 1,
          mappedColumns: 3,
          unmappedColumns: 0,
          emptyCells: 1,
        },
      };
      
      expect(getValidationSummary(result)).toContain('1 warning');
    });
    
    it('should return failure message', () => {
      const result = {
        valid: false,
        errors: [{ type: 'empty_data' as const, message: 'Empty' }],
        warnings: [],
        stats: {
          totalRows: 0,
          completeRows: 0,
          incompleteRows: 0,
          mappedColumns: 0,
          unmappedColumns: 0,
          emptyCells: 0,
        },
      };
      
      expect(getValidationSummary(result)).toContain('failed');
      expect(getValidationSummary(result)).toContain('1 error');
    });
  });
});
