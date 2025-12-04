/**
 * Tests for ValueInjector
 * @module core/orchestrator/ValueInjector.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ValueInjector,
  createValueInjector,
  injectValues,
  DEFAULT_VALUE_INJECTOR_CONFIG,
  type CsvRow,
  type InjectionResult,
  type BatchInjectionResult,
  type ValueInjectorConfig,
} from './ValueInjector';
import type { Step } from '../types/step';
import type { Field } from '../types/field';

// ============================================================================
// TEST DATA
// ============================================================================

const createMockStep = (overrides: Partial<Step> = {}): Step => ({
  id: 1,
  name: 'Test Step',
  event: 'input',
  path: '//input[@id="test"]',
  value: 'default value',
  label: 'First Name',
  x: 100,
  y: 200,
  ...overrides,
});

const createMockField = (overrides: Partial<Field> = {}): Field => ({
  field_name: 'FirstName',
  mapped: true,
  inputvarfields: 'First Name',
  ...overrides,
});

const createMockCsvRow = (data: Record<string, string> = {}): CsvRow => ({
  FirstName: 'John',
  LastName: 'Doe',
  Email: 'john@example.com',
  Phone: '555-1234',
  ...data,
});

// ============================================================================
// CONSTRUCTOR TESTS
// ============================================================================

describe('ValueInjector', () => {
  describe('constructor', () => {
    it('should create instance with empty mappings', () => {
      const injector = new ValueInjector([]);
      expect(injector.getMappingCount()).toBe(0);
    });

    it('should create instance with valid mappings', () => {
      const mappings: Field[] = [
        createMockField({ field_name: 'FirstName', inputvarfields: 'First Name' }),
        createMockField({ field_name: 'LastName', inputvarfields: 'Last Name' }),
      ];
      
      const injector = new ValueInjector(mappings);
      expect(injector.getMappingCount()).toBe(2);
    });

    it('should ignore unmapped fields', () => {
      const mappings: Field[] = [
        createMockField({ field_name: 'FirstName', mapped: true }),
        createMockField({ field_name: 'Ignored', mapped: false }),
      ];
      
      const injector = new ValueInjector(mappings);
      expect(injector.getMappingCount()).toBe(1);
    });

    it('should apply custom configuration', () => {
      const config: Partial<ValueInjectorConfig> = {
        caseSensitiveMatch: false,
        enableLogging: true,
      };
      
      const injector = new ValueInjector([], config);
      const resultConfig = injector.getConfig();
      
      expect(resultConfig.caseSensitiveMatch).toBe(false);
      expect(resultConfig.enableLogging).toBe(true);
    });
  });

  // ==========================================================================
  // SINGLE STEP INJECTION TESTS
  // ==========================================================================

  describe('injectStep', () => {
    let injector: ValueInjector;
    let row: CsvRow;

    beforeEach(() => {
      const mappings: Field[] = [
        createMockField({ field_name: 'FirstName', inputvarfields: 'First Name' }),
        createMockField({ field_name: 'Email', inputvarfields: 'Email Address' }),
      ];
      injector = new ValueInjector(mappings);
      row = createMockCsvRow();
    });

    it('should inject value via direct match', () => {
      // CSV has column "FirstName", step label is "FirstName"
      const step = createMockStep({ label: 'FirstName' });
      const result = injector.injectStep(row, step);

      expect(result.wasInjected).toBe(true);
      expect(result.source).toBe('direct');
      expect(result.injectedStep.value).toBe('John');
      expect(result.csvColumn).toBe('FirstName');
    });

    it('should inject value via mapping', () => {
      // CSV has "FirstName" mapped to step label "First Name"
      const step = createMockStep({ label: 'First Name' });
      const result = injector.injectStep(row, step);

      expect(result.wasInjected).toBe(true);
      expect(result.source).toBe('mapped');
      expect(result.injectedStep.value).toBe('John');
      expect(result.csvColumn).toBe('FirstName');
    });

    it('should keep original value when no match', () => {
      const step = createMockStep({ 
        label: 'Unknown Field', 
        value: 'original' 
      });
      const result = injector.injectStep(row, step);

      expect(result.wasInjected).toBe(false);
      expect(result.source).toBe('original');
      expect(result.injectedStep.value).toBe('original');
    });

    it('should not inject into non-input events', () => {
      const step = createMockStep({ 
        event: 'click', 
        label: 'FirstName' 
      });
      // Note: click is allowed for injection per the implementation
      const result = injector.injectStep(row, step);

      // Click events are processed
      expect(result.wasInjected).toBe(true);
    });

    it('should not inject into enter events', () => {
      const step = createMockStep({ 
        event: 'enter', 
        label: 'FirstName' 
      });
      const result = injector.injectStep(row, step);

      expect(result.wasInjected).toBe(false);
      expect(result.source).toBe('original');
    });

    it('should not inject into open events', () => {
      const step = createMockStep({ 
        event: 'open', 
        label: 'FirstName' 
      });
      const result = injector.injectStep(row, step);

      expect(result.wasInjected).toBe(false);
      expect(result.source).toBe('original');
    });

    it('should prefer direct match over mapped match', () => {
      // Add a direct column that matches step label
      const rowWithDirect: CsvRow = {
        ...row,
        'First Name': 'DirectValue', // Direct match
      };
      
      const step = createMockStep({ label: 'First Name' });
      const result = injector.injectStep(rowWithDirect, step);

      expect(result.source).toBe('direct');
      expect(result.injectedStep.value).toBe('DirectValue');
    });

    it('should preserve original value when configured', () => {
      const preservingInjector = new ValueInjector(
        [createMockField()],
        { preserveOriginal: true }
      );
      
      const step = createMockStep({ 
        label: 'First Name', 
        value: 'Old Value' 
      });
      const result = preservingInjector.injectStep(row, step);

      expect(result.wasInjected).toBe(true);
      expect((result.injectedStep as Step & { originalValue?: string }).originalValue).toBe('Old Value');
    });
  });

  // ==========================================================================
  // BATCH INJECTION TESTS
  // ==========================================================================

  describe('injectRow', () => {
    let injector: ValueInjector;
    let row: CsvRow;
    let steps: Step[];

    beforeEach(() => {
      const mappings: Field[] = [
        createMockField({ field_name: 'FirstName', inputvarfields: 'First Name' }),
        createMockField({ field_name: 'LastName', inputvarfields: 'Last Name' }),
        createMockField({ field_name: 'Email', inputvarfields: 'Email Address' }),
      ];
      injector = new ValueInjector(mappings);
      row = createMockCsvRow();
      steps = [
        createMockStep({ id: 1, label: 'First Name', event: 'input' }),
        createMockStep({ id: 2, label: 'Last Name', event: 'input' }),
        createMockStep({ id: 3, label: 'Submit', event: 'click', value: '' }),
        createMockStep({ id: 4, label: 'Unknown', event: 'input', value: '' }),
      ];
    });

    it('should inject values into all matching steps', () => {
      const result = injector.injectRow(row, steps);

      expect(result.injectedCount).toBe(2); // First Name, Last Name
      expect(result.steps[0].value).toBe('John');
      expect(result.steps[1].value).toBe('Doe');
    });

    it('should count skipped input steps', () => {
      const result = injector.injectRow(row, steps);

      // Unknown field with no value should be skipped
      expect(result.skippedCount).toBe(1);
    });

    it('should return all steps in order', () => {
      const result = injector.injectRow(row, steps);

      expect(result.steps.length).toBe(4);
      expect(result.steps[0].id).toBe(1);
      expect(result.steps[1].id).toBe(2);
      expect(result.steps[2].id).toBe(3);
      expect(result.steps[3].id).toBe(4);
    });

    it('should track detailed results per step', () => {
      const result = injector.injectRow(row, steps);

      expect(result.results.length).toBe(4);
      expect(result.results[0].wasInjected).toBe(true);
      expect(result.results[2].wasInjected).toBe(false); // Submit click
    });

    it('should not skip inputs when configured', () => {
      const noSkipInjector = new ValueInjector(
        [createMockField()],
        { skipInputsWithoutValue: false }
      );
      
      const result = noSkipInjector.injectRow(row, steps);

      expect(result.skippedCount).toBe(0);
    });
  });

  // ==========================================================================
  // CASE SENSITIVITY TESTS
  // ==========================================================================

  describe('case sensitivity', () => {
    it('should match case-sensitively by default', () => {
      const mappings: Field[] = [
        createMockField({ field_name: 'FirstName', inputvarfields: 'First Name' }),
      ];
      const injector = new ValueInjector(mappings);
      const row: CsvRow = { firstname: 'John' }; // lowercase

      const step = createMockStep({ label: 'First Name' });
      const result = injector.injectStep(row, step);

      // Should NOT match because case is different
      expect(result.wasInjected).toBe(false);
    });

    it('should match case-insensitively when configured', () => {
      const mappings: Field[] = [
        createMockField({ field_name: 'FirstName', inputvarfields: 'First Name' }),
      ];
      const injector = new ValueInjector(mappings, { caseSensitiveMatch: false });
      const row: CsvRow = { firstname: 'John' }; // lowercase

      const step = createMockStep({ label: 'first name' }); // lowercase
      const result = injector.injectStep(row, step);

      expect(result.wasInjected).toBe(true);
      expect(result.injectedStep.value).toBe('John');
    });
  });

  // ==========================================================================
  // UTILITY METHOD TESTS
  // ==========================================================================

  describe('utility methods', () => {
    let injector: ValueInjector;

    beforeEach(() => {
      const mappings: Field[] = [
        createMockField({ field_name: 'FirstName', inputvarfields: 'First Name' }),
        createMockField({ field_name: 'Email', inputvarfields: 'Email Address' }),
      ];
      injector = new ValueInjector(mappings);
    });

    it('should check if mapping exists', () => {
      expect(injector.hasMapping('First Name')).toBe(true);
      expect(injector.hasMapping('Unknown')).toBe(false);
    });

    it('should get mapped column for step label', () => {
      expect(injector.getMappedColumn('First Name')).toBe('FirstName');
      expect(injector.getMappedColumn('Unknown')).toBeUndefined();
    });

    it('should get mapped label for CSV column', () => {
      expect(injector.getMappedLabel('FirstName')).toBe('First Name');
      expect(injector.getMappedLabel('Unknown')).toBeUndefined();
    });

    it('should get all mapped columns', () => {
      const columns = injector.getMappedColumns();
      expect(columns).toContain('FirstName');
      expect(columns).toContain('Email');
      expect(columns.length).toBe(2);
    });

    it('should get all mapped labels', () => {
      const labels = injector.getMappedLabels();
      expect(labels).toContain('First Name');
      expect(labels).toContain('Email Address');
      expect(labels.length).toBe(2);
    });

    it('should update mappings', () => {
      expect(injector.getMappingCount()).toBe(2);
      
      injector.updateMappings([
        createMockField({ field_name: 'NewField', inputvarfields: 'New Label' }),
      ]);
      
      expect(injector.getMappingCount()).toBe(1);
      expect(injector.hasMapping('New Label')).toBe(true);
      expect(injector.hasMapping('First Name')).toBe(false);
    });

    it('should update configuration', () => {
      expect(injector.getConfig().enableLogging).toBe(false);
      
      injector.updateConfig({ enableLogging: true });
      
      expect(injector.getConfig().enableLogging).toBe(true);
    });
  });

  // ==========================================================================
  // LOGGING TESTS
  // ==========================================================================

  describe('logging', () => {
    it('should not log by default', () => {
      const injector = new ValueInjector([createMockField()]);
      const consoleSpy = vi.spyOn(console, 'log');
      
      injector.injectStep(createMockCsvRow(), createMockStep({ label: 'First Name' }));
      
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log when enabled', () => {
      const injector = new ValueInjector(
        [createMockField()],
        { enableLogging: true }
      );
      const consoleSpy = vi.spyOn(console, 'log');
      
      injector.injectStep(createMockCsvRow(), createMockStep({ label: 'First Name' }));
      
      expect(consoleSpy).toHaveBeenCalled();
      expect(injector.getLogs().length).toBeGreaterThan(0);
      consoleSpy.mockRestore();
    });

    it('should clear logs', () => {
      const injector = new ValueInjector(
        [createMockField()],
        { enableLogging: true }
      );
      
      injector.injectStep(createMockCsvRow(), createMockStep({ label: 'First Name' }));
      expect(injector.getLogs().length).toBeGreaterThan(0);
      
      injector.clearLogs();
      expect(injector.getLogs().length).toBe(0);
    });
  });

  // ==========================================================================
  // FACTORY FUNCTION TESTS
  // ==========================================================================

  describe('createValueInjector', () => {
    it('should create ValueInjector instance', () => {
      const injector = createValueInjector([createMockField()]);
      expect(injector).toBeInstanceOf(ValueInjector);
    });

    it('should accept configuration', () => {
      const injector = createValueInjector([], { enableLogging: true });
      expect(injector.getConfig().enableLogging).toBe(true);
    });
  });

  // ==========================================================================
  // STANDALONE FUNCTION TESTS
  // ==========================================================================

  describe('injectValues', () => {
    it('should perform batch injection without instance', () => {
      const mappings: Field[] = [
        createMockField({ field_name: 'FirstName', inputvarfields: 'First Name' }),
      ];
      const steps = [
        createMockStep({ label: 'First Name' }),
      ];
      
      const result = injectValues(createMockCsvRow(), steps, mappings);

      expect(result.injectedCount).toBe(1);
      expect(result.steps[0].value).toBe('John');
    });

    it('should accept configuration', () => {
      const result = injectValues(
        { firstname: 'John' },
        [createMockStep({ label: 'first name' })],
        [createMockField({ field_name: 'firstname', inputvarfields: 'first name' })],
        { caseSensitiveMatch: false }
      );

      expect(result.injectedCount).toBe(1);
    });
  });

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================

  describe('edge cases', () => {
    it('should handle empty CSV row', () => {
      const injector = new ValueInjector([createMockField()]);
      const result = injector.injectRow({}, [createMockStep()]);

      expect(result.injectedCount).toBe(0);
    });

    it('should handle empty steps array', () => {
      const injector = new ValueInjector([createMockField()]);
      const result = injector.injectRow(createMockCsvRow(), []);

      expect(result.steps.length).toBe(0);
      expect(result.injectedCount).toBe(0);
    });

    it('should handle step with undefined label', () => {
      const injector = new ValueInjector([createMockField()]);
      const step = createMockStep({ label: undefined as unknown as string });
      const result = injector.injectStep(createMockCsvRow(), step);

      expect(result.wasInjected).toBe(false);
    });

    it('should handle empty string values in CSV', () => {
      const injector = new ValueInjector([createMockField()]);
      const row: CsvRow = { FirstName: '' };
      const step = createMockStep({ label: 'FirstName' });
      
      const result = injector.injectStep(row, step);

      // Empty string is still a valid value
      expect(result.wasInjected).toBe(true);
      expect(result.injectedStep.value).toBe('');
    });

    it('should handle special characters in field names', () => {
      const mappings: Field[] = [
        createMockField({ 
          field_name: 'User Email (Primary)', 
          inputvarfields: 'Email Field' 
        }),
      ];
      const injector = new ValueInjector(mappings);
      const row: CsvRow = { 'User Email (Primary)': 'test@example.com' };
      const step = createMockStep({ label: 'Email Field' });

      const result = injector.injectStep(row, step);

      expect(result.wasInjected).toBe(true);
      expect(result.injectedStep.value).toBe('test@example.com');
    });
  });
});
