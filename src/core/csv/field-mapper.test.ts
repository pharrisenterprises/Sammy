/**
 * @fileoverview Tests for CSV field mapper
 * @module core/csv/field-mapper.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  FieldMapper,
  autoMapFields,
  mapAndExtractData,
  suggestMappings,
  validateRequiredMappings,
  createFieldsFromHeaders,
  iterateRowData,
  DEFAULT_AUTOMAP_OPTIONS
} from './field-mapper';
import { parseCsv } from './csv-parser';
import type { Field } from '../types';

describe('Field Mapper', () => {
  // Test data
  const testCsv = `name,email,phone,address
John Doe,john@example.com,555-1234,123 Main St
Jane Smith,jane@example.com,555-5678,456 Oak Ave`;

  const testFields: Field[] = [
    { field_name: 'name', mapped: false, inputvarfields: '' },
    { field_name: 'email', mapped: false, inputvarfields: '' },
    { field_name: 'phone', mapped: false, inputvarfields: '' },
    { field_name: 'address', mapped: false, inputvarfields: '' }
  ];

  let csvResult: ReturnType<typeof parseCsv>;

  beforeEach(() => {
    csvResult = parseCsv(testCsv);
  });

  // ==========================================================================
  // CONSTANTS
  // ==========================================================================

  describe('Constants', () => {
    it('should have correct default options', () => {
      expect(DEFAULT_AUTOMAP_OPTIONS.minConfidence).toBe(60);
      expect(DEFAULT_AUTOMAP_OPTIONS.fuzzyMatch).toBe(true);
      expect(DEFAULT_AUTOMAP_OPTIONS.caseInsensitive).toBe(true);
    });

    it('should have common synonyms defined', () => {
      expect(DEFAULT_AUTOMAP_OPTIONS.synonyms.email).toContain('e-mail');
      expect(DEFAULT_AUTOMAP_OPTIONS.synonyms.phone).toContain('telephone');
      expect(DEFAULT_AUTOMAP_OPTIONS.synonyms.zip).toContain('postal_code');
    });
  });

  // ==========================================================================
  // FIELD MAPPER CLASS
  // ==========================================================================

  describe('FieldMapper', () => {
    describe('constructor', () => {
      it('should create mapper with CSV and fields', () => {
        const mapper = new FieldMapper(csvResult, testFields);
        
        expect(mapper.getHeaders()).toEqual(['name', 'email', 'phone', 'address']);
        expect(mapper.getFieldNames()).toEqual(['name', 'email', 'phone', 'address']);
        expect(mapper.getRowCount()).toBe(2);
      });
    });

    describe('autoMap', () => {
      it('should auto-map exact matches', () => {
        const mapper = new FieldMapper(csvResult, testFields);
        
        const count = mapper.autoMap();

        expect(count).toBe(4);
        expect(mapper.isColumnMapped('name')).toBe(true);
        expect(mapper.isColumnMapped('email')).toBe(true);
      });

      it('should match with high confidence for exact matches', () => {
        const mapper = new FieldMapper(csvResult, testFields);
        mapper.autoMap();

        const mapping = mapper.getMapping('name');
        expect(mapping?.confidence).toBe(100);
        expect(mapping?.source).toBe('auto');
      });

      it('should match synonyms', () => {
        const csvWithSynonyms = `full_name,e-mail,telephone
John,john@example.com,555-1234`;
        const result = parseCsv(csvWithSynonyms);
        
        const fields: Field[] = [
          { field_name: 'name', mapped: false, inputvarfields: '' },
          { field_name: 'email', mapped: false, inputvarfields: '' },
          { field_name: 'phone', mapped: false, inputvarfields: '' }
        ];

        const mapper = new FieldMapper(result, fields);
        mapper.autoMap();

        expect(mapper.isColumnMapped('e-mail')).toBe(true);
        expect(mapper.isColumnMapped('telephone')).toBe(true);
      });

      it('should respect minConfidence option', () => {
        const mapper = new FieldMapper(csvResult, testFields, {
          minConfidence: 100
        });
        
        mapper.autoMap();

        // Should only match exact (100% confidence) matches
        expect(mapper.getAllMappings().every(m => m.confidence >= 100)).toBe(true);
      });
    });

    describe('manual mapping', () => {
      it('should add manual mapping', () => {
        const mapper = new FieldMapper(csvResult, testFields);

        mapper.addMapping({
          csvColumn: 'name',
          csvColumnIndex: 0,
          field_name: 'name',
          enabled: true,
          confidence: 100,
          source: 'manual'
        });

        expect(mapper.isColumnMapped('name')).toBe(true);
      });

      it('should remove mapping by column', () => {
        const mapper = new FieldMapper(csvResult, testFields);
        mapper.autoMap();

        const removed = mapper.removeMapping('name');

        expect(removed).toBe(true);
        expect(mapper.isColumnMapped('name')).toBe(false);
      });

      it('should remove mapping by field', () => {
        const mapper = new FieldMapper(csvResult, testFields);
        mapper.autoMap();

        const removed = mapper.removeMappingByField('email');

        expect(removed).toBe(true);
        expect(mapper.isFieldMapped('email')).toBe(false);
      });

      it('should update mapping', () => {
        const mapper = new FieldMapper(csvResult, testFields);
        mapper.autoMap();

        const updated = mapper.updateMapping('name', { enabled: false });

        expect(updated).toBe(true);
        expect(mapper.getMapping('name')?.enabled).toBe(false);
      });

      it('should enable/disable mapping', () => {
        const mapper = new FieldMapper(csvResult, testFields);
        mapper.autoMap();

        mapper.setMappingEnabled('name', false);
        expect(mapper.isColumnMapped('name')).toBe(false);

        mapper.setMappingEnabled('name', true);
        expect(mapper.isColumnMapped('name')).toBe(true);
      });

      it('should clear all mappings', () => {
        const mapper = new FieldMapper(csvResult, testFields);
        mapper.autoMap();

        mapper.clearMappings();

        expect(mapper.getAllMappings()).toHaveLength(0);
      });
    });

    describe('mapping queries', () => {
      it('should get mapping by column', () => {
        const mapper = new FieldMapper(csvResult, testFields);
        mapper.autoMap();

        const mapping = mapper.getMapping('email');

        expect(mapping?.field_name).toBe('email');
      });

      it('should get mapping by field', () => {
        const mapper = new FieldMapper(csvResult, testFields);
        mapper.autoMap();

        const mapping = mapper.getMappingByField('phone');

        expect(mapping?.csvColumn).toBe('phone');
      });

      it('should get all mappings', () => {
        const mapper = new FieldMapper(csvResult, testFields);
        mapper.autoMap();

        const mappings = mapper.getAllMappings();

        expect(mappings.length).toBe(4);
      });

      it('should get only enabled mappings', () => {
        const mapper = new FieldMapper(csvResult, testFields);
        mapper.autoMap();
        mapper.setMappingEnabled('name', false);

        const enabled = mapper.getEnabledMappings();

        expect(enabled.length).toBe(3);
        expect(enabled.every(m => m.enabled)).toBe(true);
      });
    });

    describe('getConfiguration', () => {
      it('should return complete configuration', () => {
        const mapper = new FieldMapper(csvResult, testFields);
        mapper.autoMap();

        const config = mapper.getConfiguration();

        expect(config.mappings.length).toBe(4);
        expect(config.unmappedColumns).toHaveLength(0);
        expect(config.unmappedFields).toHaveLength(0);
        expect(config.complete).toBe(true);
        expect(config.qualityScore).toBeGreaterThan(0);
      });

      it('should report unmapped columns and fields', () => {
        const extraFields: Field[] = [
          ...testFields,
          { field_name: 'company', mapped: false, inputvarfields: '' }
        ];
        const mapper = new FieldMapper(csvResult, extraFields);
        mapper.autoMap();

        const config = mapper.getConfiguration();

        expect(config.unmappedFields).toContain('company');
        expect(config.complete).toBe(false);
      });
    });

    describe('data injection', () => {
      it('should get row data', () => {
        const mapper = new FieldMapper(csvResult, testFields);
        mapper.autoMap();

        const rowData = mapper.getRowData(0);

        expect(rowData).not.toBeNull();
        expect(rowData?.values.name).toBe('John Doe');
        expect(rowData?.values.email).toBe('john@example.com');
      });

      it('should return null for invalid row index', () => {
        const mapper = new FieldMapper(csvResult, testFields);
        mapper.autoMap();

        const rowData = mapper.getRowData(99);

        expect(rowData).toBeNull();
      });

      it('should get all row data', () => {
        const mapper = new FieldMapper(csvResult, testFields);
        mapper.autoMap();

        const batch = mapper.getAllRowData();

        expect(batch.totalRows).toBe(2);
        expect(batch.rows).toHaveLength(2);
        expect(batch.successfulRows).toBe(2);
      });

      it('should get specific field value', () => {
        const mapper = new FieldMapper(csvResult, testFields);
        mapper.autoMap();

        const value = mapper.getFieldValue(0, 'email');

        expect(value).toBe('john@example.com');
      });

      it('should return null for unmapped field', () => {
        const mapper = new FieldMapper(csvResult, testFields);
        // Don't auto-map

        const value = mapper.getFieldValue(0, 'email');

        expect(value).toBeNull();
      });
    });

    describe('export/import', () => {
      it('should export mappings as JSON', () => {
        const mapper = new FieldMapper(csvResult, testFields);
        mapper.autoMap();

        const json = mapper.exportMappings();
        const parsed = JSON.parse(json);

        expect(Array.isArray(parsed)).toBe(true);
        expect(parsed.length).toBe(4);
      });

      it('should import mappings from JSON', () => {
        const mapper = new FieldMapper(csvResult, testFields);
        mapper.autoMap();
        const json = mapper.exportMappings();

        const newMapper = new FieldMapper(csvResult, testFields);
        const count = newMapper.importMappings(json);

        expect(count).toBe(4);
        expect(newMapper.getAllMappings()).toHaveLength(4);
      });

      it('should return 0 for invalid JSON', () => {
        const mapper = new FieldMapper(csvResult, testFields);
        const count = mapper.importMappings('invalid json');

        expect(count).toBe(0);
      });
    });
  });

  // ==========================================================================
  // STANDALONE FUNCTIONS
  // ==========================================================================

  describe('Standalone Functions', () => {
    describe('autoMapFields', () => {
      it('should auto-map and return configuration', () => {
        const config = autoMapFields(csvResult, testFields);

        expect(config.mappings.length).toBe(4);
        expect(config.complete).toBe(true);
      });
    });

    describe('mapAndExtractData', () => {
      it('should map and return all row data', () => {
        const batch = mapAndExtractData(csvResult, testFields);

        expect(batch.totalRows).toBe(2);
        expect(batch.rows[0].values.name).toBe('John Doe');
      });
    });

    describe('suggestMappings', () => {
      it('should suggest mappings for headers', () => {
        const suggestions = suggestMappings(
          ['name', 'email', 'phone'],
          ['name', 'email', 'phone']
        );

        expect(suggestions).toHaveLength(3);
        expect(suggestions[0].suggestedField).toBe('name');
        expect(suggestions[0].confidence).toBe(100);
      });
    });

    describe('validateRequiredMappings', () => {
      it('should validate required mappings', () => {
        const config = autoMapFields(csvResult, testFields);
        
        const result = validateRequiredMappings(config, ['name', 'email']);

        expect(result.valid).toBe(true);
        expect(result.missingFields).toHaveLength(0);
      });

      it('should report missing required fields', () => {
        const config = autoMapFields(csvResult, testFields);
        
        const result = validateRequiredMappings(config, ['name', 'ssn']);

        expect(result.valid).toBe(false);
        expect(result.missingFields).toContain('ssn');
      });
    });

    describe('createFieldsFromHeaders', () => {
      it('should create fields from CSV headers', () => {
        const fields = createFieldsFromHeaders(['name', 'email', 'phone']);

        expect(fields).toHaveLength(3);
        expect(fields[0].field_name).toBe('name');
        expect(fields[0].mapped).toBe(false);
        expect(fields[0].inputvarfields).toBe('');
      });
    });

    describe('iterateRowData', () => {
      it('should iterate over row data', () => {
        const mapper = new FieldMapper(csvResult, testFields);
        mapper.autoMap();

        const rows: ReturnType<typeof mapper.getRowData>[] = [];
        for (const row of iterateRowData(mapper)) {
          rows.push(row);
        }

        expect(rows).toHaveLength(2);
        expect(rows[0]?.values.name).toBe('John Doe');
      });
    });
  });

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle empty CSV', () => {
      const emptyResult = parseCsv('name,email');
      const mapper = new FieldMapper(emptyResult, testFields);
      mapper.autoMap();

      const batch = mapper.getAllRowData();

      expect(batch.totalRows).toBe(0);
      expect(batch.rows).toHaveLength(0);
    });

    it('should handle empty fields array', () => {
      const mapper = new FieldMapper(csvResult, []);
      const count = mapper.autoMap();

      expect(count).toBe(0);
      expect(mapper.getAllMappings()).toHaveLength(0);
    });

    it('should handle case differences', () => {
      const csv = 'NAME,EMAIL,PHONE';
      const result = parseCsv(csv + '\nJohn,john@example.com,555-1234');
      
      const mapper = new FieldMapper(result, testFields, {
        caseInsensitive: true
      });
      mapper.autoMap();

      expect(mapper.isColumnMapped('NAME')).toBe(true);
    });

    it('should handle special characters in headers', () => {
      const csv = 'user_name,e-mail,phone#';
      const result = parseCsv(csv + '\nJohn,john@example.com,555-1234');
      
      const fields: Field[] = [
        { field_name: 'username', mapped: false, inputvarfields: '' },
        { field_name: 'email', mapped: false, inputvarfields: '' }
      ];

      const mapper = new FieldMapper(result, fields);
      mapper.autoMap();

      // Should match user_name to username and e-mail to email
      expect(mapper.getAllMappings().length).toBeGreaterThan(0);
    });
  });
});
