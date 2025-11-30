/**
 * @fileoverview Tests for Field type definitions
 * @module core/types/field.test
 */

import { describe, it, expect } from 'vitest';
import {
  type Field,
  AUTO_MAP_THRESHOLD,
  isField,
  isMappedField,
  isUnmappedField,
  createUnmappedField,
  createMappedField,
  createField,
  createFieldsFromHeaders,
  mapField,
  unmapField,
  toggleFieldMapping,
  updateFieldInArray,
  getMappedFields,
  getUnmappedFields,
  getFieldByName,
  getFieldByTarget,
  isTargetMapped,
  getAvailableTargets,
  getFieldMappingStats,
  validateField,
  validateFieldArray,
  fieldToExportFormat,
  createFieldLookupMap,
  createReverseFieldLookupMap
} from './field';

describe('Field Types', () => {
  // ==========================================================================
  // CONSTANTS
  // ==========================================================================

  describe('AUTO_MAP_THRESHOLD', () => {
    it('should be 0.3 (30%)', () => {
      expect(AUTO_MAP_THRESHOLD).toBe(0.3);
    });

    it('should NOT be 0.8 (80%)', () => {
      expect(AUTO_MAP_THRESHOLD).not.toBe(0.8);
    });
  });

  // ==========================================================================
  // TYPE GUARDS
  // ==========================================================================

  describe('isField', () => {
    it('should return true for valid field', () => {
      const field: Field = {
        field_name: 'username',
        mapped: true,
        inputvarfields: 'Username'
      };
      expect(isField(field)).toBe(true);
    });

    it('should return true for unmapped field', () => {
      const field: Field = {
        field_name: 'unused',
        mapped: false,
        inputvarfields: ''
      };
      expect(isField(field)).toBe(true);
    });

    it('should return false for null/undefined', () => {
      expect(isField(null)).toBe(false);
      expect(isField(undefined)).toBe(false);
    });

    it('should return false for missing properties', () => {
      expect(isField({ field_name: 'test' })).toBe(false);
      expect(isField({ mapped: true })).toBe(false);
      expect(isField({ inputvarfields: 'test' })).toBe(false);
    });

    it('should return false for wrong property types', () => {
      expect(isField({ field_name: 123, mapped: true, inputvarfields: '' })).toBe(false);
      expect(isField({ field_name: 'test', mapped: 'yes', inputvarfields: '' })).toBe(false);
      expect(isField({ field_name: 'test', mapped: true, inputvarfields: null })).toBe(false);
    });

    it('should return false for wrong property names (camelCase)', () => {
      // This is the WRONG interface format
      const wrongFormat = {
        fieldName: 'test',  // Should be field_name
        mapped: true,
        inputVarFields: 'Target'  // Should be inputvarfields
      };
      expect(isField(wrongFormat)).toBe(false);
    });
  });

  describe('isMappedField', () => {
    it('should return true for mapped field with target', () => {
      const field: Field = {
        field_name: 'email',
        mapped: true,
        inputvarfields: 'Email Address'
      };
      expect(isMappedField(field)).toBe(true);
    });

    it('should return false for unmapped field', () => {
      const field: Field = {
        field_name: 'unused',
        mapped: false,
        inputvarfields: ''
      };
      expect(isMappedField(field)).toBe(false);
    });

    it('should return false for mapped=true but empty target', () => {
      const field: Field = {
        field_name: 'broken',
        mapped: true,
        inputvarfields: ''
      };
      expect(isMappedField(field)).toBe(false);
    });
  });

  describe('isUnmappedField', () => {
    it('should return true for unmapped field', () => {
      const field: Field = {
        field_name: 'unused',
        mapped: false,
        inputvarfields: ''
      };
      expect(isUnmappedField(field)).toBe(true);
    });

    it('should return false for mapped field', () => {
      const field: Field = {
        field_name: 'email',
        mapped: true,
        inputvarfields: 'Email'
      };
      expect(isUnmappedField(field)).toBe(false);
    });
  });

  // ==========================================================================
  // FACTORY FUNCTIONS
  // ==========================================================================

  describe('createUnmappedField', () => {
    it('should create unmapped field from name', () => {
      const field = createUnmappedField('username');

      expect(field.field_name).toBe('username');
      expect(field.mapped).toBe(false);
      expect(field.inputvarfields).toBe('');
    });

    it('should trim whitespace', () => {
      const field = createUnmappedField('  padded name  ');
      expect(field.field_name).toBe('padded name');
    });
  });

  describe('createMappedField', () => {
    it('should create mapped field with target', () => {
      const field = createMappedField('user_email', 'Email Address');

      expect(field.field_name).toBe('user_email');
      expect(field.mapped).toBe(true);
      expect(field.inputvarfields).toBe('Email Address');
    });

    it('should trim whitespace from both values', () => {
      const field = createMappedField('  name  ', '  Target  ');
      expect(field.field_name).toBe('name');
      expect(field.inputvarfields).toBe('Target');
    });
  });

  describe('createField', () => {
    it('should create unmapped field by default', () => {
      const field = createField({ field_name: 'test' });

      expect(field.mapped).toBe(false);
      expect(field.inputvarfields).toBe('');
    });

    it('should create mapped field when specified', () => {
      const field = createField({
        field_name: 'test',
        mapped: true,
        inputvarfields: 'Target'
      });

      expect(field.mapped).toBe(true);
      expect(field.inputvarfields).toBe('Target');
    });

    it('should reset to unmapped if mapped=true but no target', () => {
      const field = createField({
        field_name: 'test',
        mapped: true,
        inputvarfields: ''
      });

      expect(field.mapped).toBe(false);
      expect(field.inputvarfields).toBe('');
    });
  });

  describe('createFieldsFromHeaders', () => {
    it('should create unmapped fields from headers', () => {
      const headers = ['username', 'password', 'email'];
      const fields = createFieldsFromHeaders(headers);

      expect(fields).toHaveLength(3);
      expect(fields[0].field_name).toBe('username');
      expect(fields[0].mapped).toBe(false);
      expect(fields[1].field_name).toBe('password');
      expect(fields[2].field_name).toBe('email');
    });

    it('should filter out empty headers', () => {
      const headers = ['valid', '', '  ', 'also_valid'];
      const fields = createFieldsFromHeaders(headers);

      expect(fields).toHaveLength(2);
      expect(fields[0].field_name).toBe('valid');
      expect(fields[1].field_name).toBe('also_valid');
    });
  });

  // ==========================================================================
  // MAPPING FUNCTIONS
  // ==========================================================================

  describe('mapField', () => {
    it('should map unmapped field', () => {
      const unmapped: Field = {
        field_name: 'email',
        mapped: false,
        inputvarfields: ''
      };

      const mapped = mapField(unmapped, 'Email Address');

      expect(mapped.mapped).toBe(true);
      expect(mapped.inputvarfields).toBe('Email Address');
      expect(unmapped.mapped).toBe(false); // Original unchanged
    });

    it('should remap already mapped field', () => {
      const existing: Field = {
        field_name: 'email',
        mapped: true,
        inputvarfields: 'Old Target'
      };

      const remapped = mapField(existing, 'New Target');

      expect(remapped.inputvarfields).toBe('New Target');
    });
  });

  describe('unmapField', () => {
    it('should unmap mapped field', () => {
      const mapped: Field = {
        field_name: 'email',
        mapped: true,
        inputvarfields: 'Email'
      };

      const unmapped = unmapField(mapped);

      expect(unmapped.mapped).toBe(false);
      expect(unmapped.inputvarfields).toBe('');
      expect(mapped.mapped).toBe(true); // Original unchanged
    });
  });

  describe('toggleFieldMapping', () => {
    it('should map unmapped field when target provided', () => {
      const field: Field = { field_name: 'test', mapped: false, inputvarfields: '' };
      const toggled = toggleFieldMapping(field, 'Target');

      expect(toggled.mapped).toBe(true);
      expect(toggled.inputvarfields).toBe('Target');
    });

    it('should unmap mapped field', () => {
      const field: Field = { field_name: 'test', mapped: true, inputvarfields: 'Target' };
      const toggled = toggleFieldMapping(field);

      expect(toggled.mapped).toBe(false);
      expect(toggled.inputvarfields).toBe('');
    });

    it('should return same field if unmapped and no target', () => {
      const field: Field = { field_name: 'test', mapped: false, inputvarfields: '' };
      const result = toggleFieldMapping(field);

      expect(result).toBe(field);
    });
  });

  describe('updateFieldInArray', () => {
    it('should update matching field', () => {
      const fields: Field[] = [
        { field_name: 'a', mapped: false, inputvarfields: '' },
        { field_name: 'b', mapped: false, inputvarfields: '' }
      ];

      const updated = updateFieldInArray(fields, 'a', { mapped: true, inputvarfields: 'Target' });

      expect(updated[0].mapped).toBe(true);
      expect(updated[0].inputvarfields).toBe('Target');
      expect(updated[1].mapped).toBe(false);
      expect(fields[0].mapped).toBe(false); // Original unchanged
    });

    it('should enforce consistency on update', () => {
      const fields: Field[] = [
        { field_name: 'a', mapped: true, inputvarfields: 'Target' }
      ];

      const updated = updateFieldInArray(fields, 'a', { mapped: true, inputvarfields: '' });

      expect(updated[0].mapped).toBe(false); // Reset to unmapped
      expect(updated[0].inputvarfields).toBe('');
    });
  });

  // ==========================================================================
  // QUERY FUNCTIONS
  // ==========================================================================

  describe('getMappedFields', () => {
    it('should return only mapped fields', () => {
      const fields: Field[] = [
        { field_name: 'a', mapped: true, inputvarfields: 'A' },
        { field_name: 'b', mapped: false, inputvarfields: '' },
        { field_name: 'c', mapped: true, inputvarfields: 'C' }
      ];

      const mapped = getMappedFields(fields);

      expect(mapped).toHaveLength(2);
      expect(mapped[0].field_name).toBe('a');
      expect(mapped[1].field_name).toBe('c');
    });
  });

  describe('getUnmappedFields', () => {
    it('should return only unmapped fields', () => {
      const fields: Field[] = [
        { field_name: 'a', mapped: true, inputvarfields: 'A' },
        { field_name: 'b', mapped: false, inputvarfields: '' },
        { field_name: 'c', mapped: false, inputvarfields: '' }
      ];

      const unmapped = getUnmappedFields(fields);

      expect(unmapped).toHaveLength(2);
      expect(unmapped[0].field_name).toBe('b');
      expect(unmapped[1].field_name).toBe('c');
    });
  });

  describe('getFieldByName', () => {
    const fields: Field[] = [
      { field_name: 'username', mapped: true, inputvarfields: 'User' },
      { field_name: 'password', mapped: false, inputvarfields: '' }
    ];

    it('should find field by name', () => {
      expect(getFieldByName(fields, 'username')?.inputvarfields).toBe('User');
    });

    it('should return undefined for non-existent name', () => {
      expect(getFieldByName(fields, 'nonexistent')).toBeUndefined();
    });
  });

  describe('getFieldByTarget', () => {
    const fields: Field[] = [
      { field_name: 'username', mapped: true, inputvarfields: 'Username Field' },
      { field_name: 'other', mapped: false, inputvarfields: '' }
    ];

    it('should find field by target label', () => {
      expect(getFieldByTarget(fields, 'Username Field')?.field_name).toBe('username');
    });

    it('should return undefined for unmapped target', () => {
      expect(getFieldByTarget(fields, 'Nonexistent')).toBeUndefined();
    });
  });

  describe('isTargetMapped', () => {
    const fields: Field[] = [
      { field_name: 'a', mapped: true, inputvarfields: 'Target A' }
    ];

    it('should return true for mapped target', () => {
      expect(isTargetMapped(fields, 'Target A')).toBe(true);
    });

    it('should return false for unmapped target', () => {
      expect(isTargetMapped(fields, 'Target B')).toBe(false);
    });
  });

  describe('getAvailableTargets', () => {
    it('should return targets not yet mapped', () => {
      const fields: Field[] = [
        { field_name: 'a', mapped: true, inputvarfields: 'Target 1' }
      ];
      const allTargets = ['Target 1', 'Target 2', 'Target 3'];

      const available = getAvailableTargets(fields, allTargets);

      expect(available).toEqual(['Target 2', 'Target 3']);
    });
  });

  // ==========================================================================
  // STATISTICS
  // ==========================================================================

  describe('getFieldMappingStats', () => {
    it('should calculate correct statistics', () => {
      const fields: Field[] = [
        { field_name: 'a', mapped: true, inputvarfields: 'A' },
        { field_name: 'b', mapped: true, inputvarfields: 'B' },
        { field_name: 'c', mapped: false, inputvarfields: '' },
        { field_name: 'd', mapped: false, inputvarfields: '' }
      ];

      const stats = getFieldMappingStats(fields);

      expect(stats.total_fields).toBe(4);
      expect(stats.mapped_count).toBe(2);
      expect(stats.unmapped_count).toBe(2);
      expect(stats.mapping_percentage).toBe(50);
    });

    it('should handle empty array', () => {
      const stats = getFieldMappingStats([]);

      expect(stats.total_fields).toBe(0);
      expect(stats.mapping_percentage).toBe(0);
    });
  });

  // ==========================================================================
  // VALIDATION
  // ==========================================================================

  describe('validateField', () => {
    it('should return empty array for valid field', () => {
      const field: Field = {
        field_name: 'username',
        mapped: true,
        inputvarfields: 'Username'
      };
      expect(validateField(field)).toEqual([]);
    });

    it('should return error for missing field_name', () => {
      const errors = validateField({ mapped: false, inputvarfields: '' });
      expect(errors.some(e => e.field === 'field_name')).toBe(true);
    });

    it('should return error for mapped without target', () => {
      const errors = validateField({
        field_name: 'test',
        mapped: true,
        inputvarfields: ''
      });
      expect(errors.some(e => e.field === 'inputvarfields')).toBe(true);
    });

    it('should return error for unmapped with target', () => {
      const errors = validateField({
        field_name: 'test',
        mapped: false,
        inputvarfields: 'Should not have this'
      });
      expect(errors.some(e => e.field === 'general')).toBe(true);
    });
  });

  describe('validateFieldArray', () => {
    it('should detect duplicate field names', () => {
      const fields: Field[] = [
        { field_name: 'same', mapped: false, inputvarfields: '' },
        { field_name: 'same', mapped: false, inputvarfields: '' }
      ];

      const errors = validateFieldArray(fields);
      expect(errors.some(e => e.message.includes('Duplicate field name'))).toBe(true);
    });

    it('should detect duplicate target mappings', () => {
      const fields: Field[] = [
        { field_name: 'a', mapped: true, inputvarfields: 'Same Target' },
        { field_name: 'b', mapped: true, inputvarfields: 'Same Target' }
      ];

      const errors = validateFieldArray(fields);
      expect(errors.some(e => e.message.includes('Duplicate target'))).toBe(true);
    });
  });

  // ==========================================================================
  // SERIALIZATION
  // ==========================================================================

  describe('createFieldLookupMap', () => {
    it('should create map of target -> field_name', () => {
      const fields: Field[] = [
        { field_name: 'username', mapped: true, inputvarfields: 'Username Field' },
        { field_name: 'password', mapped: true, inputvarfields: 'Password Field' },
        { field_name: 'unused', mapped: false, inputvarfields: '' }
      ];

      const map = createFieldLookupMap(fields);

      expect(map.get('Username Field')).toBe('username');
      expect(map.get('Password Field')).toBe('password');
      expect(map.has('unused')).toBe(false);
    });
  });

  describe('createReverseFieldLookupMap', () => {
    it('should create map of field_name -> target', () => {
      const fields: Field[] = [
        { field_name: 'username', mapped: true, inputvarfields: 'Username Field' },
        { field_name: 'unused', mapped: false, inputvarfields: '' }
      ];

      const map = createReverseFieldLookupMap(fields);

      expect(map.get('username')).toBe('Username Field');
      expect(map.has('unused')).toBe(false);
    });
  });

  describe('fieldToExportFormat', () => {
    it('should format mapped field for export', () => {
      const field: Field = {
        field_name: 'email',
        mapped: true,
        inputvarfields: 'Email Address'
      };

      const exported = fieldToExportFormat(field);

      expect(exported['CSV Column']).toBe('email');
      expect(exported['Mapped']).toBe('Yes');
      expect(exported['Target Step']).toBe('Email Address');
    });

    it('should format unmapped field for export', () => {
      const field: Field = {
        field_name: 'unused',
        mapped: false,
        inputvarfields: ''
      };

      const exported = fieldToExportFormat(field);

      expect(exported['Mapped']).toBe('No');
      expect(exported['Target Step']).toBe('-');
    });
  });
});
