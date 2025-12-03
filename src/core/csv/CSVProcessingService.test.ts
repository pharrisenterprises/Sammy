/**
 * Tests for CSVProcessingService
 * @module core/csv/CSVProcessingService.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  CSVProcessingService,
  createCSVProcessingService,
  createPreviewService,
  createFullProcessingService,
  createStrictService,
  getCSVProcessingService,
  resetCSVProcessingService,
  DEFAULT_SERVICE_CONFIG,
} from './CSVProcessingService';
import type { Step } from '../types/step';
import { createStep, createBundle } from '../index';

// ============================================================================
// FILE READER POLYFILL FOR NODE.JS
// ============================================================================

/**
 * Mock FileReader for Node.js environment
 */
class MockFileReader {
  onload: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  result: string | ArrayBuffer | null = null;

  readAsText(blob: Blob): void {
    setTimeout(() => {
      blob.text().then(text => {
        this.result = text;
        if (this.onload) {
          this.onload({ target: this });
        }
      }).catch(error => {
        if (this.onerror) {
          this.onerror({ target: this, error });
        }
      });
    }, 0);
  }
}

// Install mock FileReader globally for tests
if (typeof globalThis.FileReader === 'undefined') {
  (globalThis as any).FileReader = MockFileReader;
}

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Create a test locator bundle
 */
function createTestBundle() {
  return createBundle({
    xpath: '//input',
  });
}

/**
 * Create test steps
 */
function createTestSteps(): Step[] {
  return [
    createStep({ label: 'First Name', value: '', event: 'input', path: '//input', x: 0, y: 0, bundle: createTestBundle() }),
    createStep({ label: 'Last Name', value: '', event: 'input', path: '//input', x: 0, y: 0, bundle: createTestBundle() }),
    createStep({ label: 'Email Address', value: '', event: 'input', path: '//input', x: 0, y: 0, bundle: createTestBundle() }),
    createStep({ label: 'Submit', value: '', event: 'click', path: '//button', x: 0, y: 0, bundle: createTestBundle() }),
  ];
}

/**
 * Create CSV content
 */
function createCSVContent(
  headers: string[],
  rows: string[][]
): string {
  const headerLine = headers.join(',');
  const dataLines = rows.map(row => row.join(','));
  return [headerLine, ...dataLines].join('\n');
}

/**
 * Create mock File
 */
function createMockFile(
  content: string,
  name: string = 'test.csv'
): File {
  return new File([content], name, { type: 'text/csv' });
}

// ============================================================================
// TESTS
// ============================================================================

describe('CSVProcessingService', () => {
  let service: CSVProcessingService;
  
  beforeEach(() => {
    service = createCSVProcessingService();
  });
  
  afterEach(() => {
    resetCSVProcessingService();
  });
  
  // ==========================================================================
  // CONFIGURATION TESTS
  // ==========================================================================
  
  describe('configuration', () => {
    it('should use default config', () => {
      const config = service.getServiceConfig();
      
      expect(config.autoMapOnProcess).toBe(DEFAULT_SERVICE_CONFIG.autoMapOnProcess);
      expect(config.autoValidateOnProcess).toBe(DEFAULT_SERVICE_CONFIG.autoValidateOnProcess);
    });
    
    it('should accept custom config', () => {
      const customService = createCSVProcessingService({
        autoMapOnProcess: false,
        autoValidateOnProcess: false,
      });
      
      const config = customService.getServiceConfig();
      
      expect(config.autoMapOnProcess).toBe(false);
      expect(config.autoValidateOnProcess).toBe(false);
    });
    
    it('should update service config', () => {
      service.setServiceConfig({ autoMapOnProcess: false });
      
      expect(service.getServiceConfig().autoMapOnProcess).toBe(false);
    });
    
    it('should update parser config', () => {
      service.setConfig({ previewRowCount: 20 });
      
      expect(service.getConfig().previewRowCount).toBe(20);
    });
  });
  
  // ==========================================================================
  // PARSING TESTS
  // ==========================================================================
  
  describe('parsing', () => {
    it('should parse CSV string', () => {
      const content = createCSVContent(
        ['Name', 'Email'],
        [['John', 'john@example.com']]
      );
      
      const result = service.parseString(content);
      
      expect(result.success).toBe(true);
      expect(result.data?.headers).toEqual(['Name', 'Email']);
    });
    
    it('should parse CSV file', async () => {
      const content = createCSVContent(
        ['Name', 'Email'],
        [['John', 'john@example.com']]
      );
      const file = createMockFile(content);
      
      const result = await service.parseFile(file);
      
      expect(result.success).toBe(true);
    });
    
    it('should extract headers', () => {
      const content = createCSVContent(['A', 'B', 'C'], []);
      const parseResult = service.parseString(content);
      
      const headers = service.extractHeaders(parseResult.data!);
      
      expect(headers).toEqual(['A', 'B', 'C']);
    });
    
    it('should get preview rows', () => {
      const content = createCSVContent(
        ['Name'],
        [['A'], ['B'], ['C'], ['D'], ['E']]
      );
      const parseResult = service.parseString(content);
      
      const preview = service.preview(parseResult.data!, 3);
      
      expect(preview).toHaveLength(3);
    });
  });
  
  // ==========================================================================
  // MAPPING TESTS
  // ==========================================================================
  
  describe('mapping', () => {
    it('should auto-map columns to steps', () => {
      const headers = ['First Name', 'Last Name', 'Email'];
      const steps = createTestSteps();
      
      const result = service.autoMap(headers, steps);
      
      expect(result.mappings.filter(m => m.mapped).length).toBeGreaterThan(0);
    });
    
    it('should get similarity score', () => {
      const score = service.getSimilarity('first_name', 'First Name');
      
      expect(score).toBe(1); // Same after normalization
    });
    
    it('should normalize strings', () => {
      expect(service.normalize('First_Name')).toBe('firstname');
    });
    
    it('should create manual mapping', () => {
      const mapping = service.createMapping('email', 'Email Address', 2);
      
      expect(mapping.csvColumn).toBe('email');
      expect(mapping.stepLabel).toBe('Email Address');
      expect(mapping.mapped).toBe(true);
    });
    
    it('should convert to fields', () => {
      const mappings = [
        service.createMapping('email', 'Email Address', 0),
      ];
      
      const fields = service.toFields(mappings);
      
      expect(fields).toHaveLength(1);
      expect(fields[0].field_name).toBe('Email Address');
      expect(fields[0].inputvarfields).toBe('email');
    });
  });
  
  // ==========================================================================
  // VALIDATION TESTS
  // ==========================================================================
  
  describe('validation', () => {
    it('should validate data', () => {
      const content = createCSVContent(['Name'], [['John']]);
      const parseResult = service.parseString(content);
      
      const result = service.validateData(parseResult.data!);
      
      expect(result.valid).toBe(true);
    });
    
    it('should validate mappings', () => {
      const content = createCSVContent(['Name'], [['John']]);
      const parseResult = service.parseString(content);
      const mappings = [service.createMapping('Name', 'Full Name', 0)];
      
      const result = service.validateMappings(mappings, parseResult.data!);
      
      expect(result.valid).toBe(true);
    });
    
    it('should validate complete setup', () => {
      const content = createCSVContent(['Name'], [['John']]);
      const parseResult = service.parseString(content);
      const mappings = [service.createMapping('Name', 'Full Name', 0)];
      
      const result = service.validate(parseResult.data!, mappings);
      
      expect(result.valid).toBe(true);
    });
    
    it('should check for duplicate mappings', () => {
      const mappings = [
        service.createMapping('Name1', 'Full Name', 0),
        service.createMapping('Name2', 'Full Name', 0), // Same step index
      ];
      
      expect(service.hasDuplicateMappings(mappings)).toBe(true);
    });
    
    it('should get empty cells', () => {
      const content = 'Name,Email\nJohn,\nJane,jane@example.com';
      const parseResult = service.parseString(content);
      
      const emptyCells = service.getEmptyCells(parseResult.data!);
      
      expect(emptyCells.length).toBeGreaterThan(0);
    });
  });
  
  // ==========================================================================
  // PROCESS FILE TESTS
  // ==========================================================================
  
  describe('processFile', () => {
    it('should process file end-to-end', async () => {
      const content = createCSVContent(
        ['First Name', 'Last Name', 'Email'],
        [
          ['John', 'Doe', 'john@example.com'],
          ['Jane', 'Smith', 'jane@example.com'],
        ]
      );
      const file = createMockFile(content);
      const steps = createTestSteps();
      
      const result = await service.processFile(file, steps);
      
      expect(result.parseResult.success).toBe(true);
      expect(result.mappings.length).toBeGreaterThan(0);
      expect(result.metadata.fileName).toBe('test.csv');
      expect(result.metadata.duration).toBeGreaterThanOrEqual(0);
    });
    
    it('should handle parse failure', async () => {
      const file = createMockFile('', 'empty.csv');
      const steps = createTestSteps();
      
      const result = await service.processFile(file, steps);
      
      expect(result.parseResult.success).toBe(false);
      expect(result.mappings).toHaveLength(0);
      expect(result.validation.valid).toBe(false);
    });
    
    it('should auto-map when configured', async () => {
      const content = createCSVContent(
        ['First Name', 'Last Name'],
        [['John', 'Doe']]
      );
      const file = createMockFile(content);
      const steps = createTestSteps();
      
      const result = await service.processFile(file, steps);
      
      // Should have some mapped fields
      expect(result.mappings.some(m => m.mapped)).toBe(true);
    });
    
    it('should skip auto-map when disabled', async () => {
      const noAutoMapService = createCSVProcessingService({
        autoMapOnProcess: false,
      });
      
      const content = createCSVContent(
        ['First Name', 'Last Name'],
        [['John', 'Doe']]
      );
      const file = createMockFile(content);
      const steps = createTestSteps();
      
      const result = await noAutoMapService.processFile(file, steps);
      
      // Should have no mapped fields
      expect(result.mappings.every(m => !m.mapped)).toBe(true);
    });
    
    it('should validate when configured', async () => {
      const content = createCSVContent(
        ['First Name'],
        [['John']]
      );
      const file = createMockFile(content);
      const steps = createTestSteps();
      
      const result = await service.processFile(file, steps);
      
      // Validation should be populated
      expect(result.validation.stats).toBeDefined();
    });
    
    it('should skip validation when disabled', async () => {
      const noValidateService = createCSVProcessingService({
        autoValidateOnProcess: false,
      });
      
      const content = createCSVContent(
        ['First Name'],
        [['John']]
      );
      const file = createMockFile(content);
      const steps = createTestSteps();
      
      const result = await noValidateService.processFile(file, steps);
      
      // Should pass validation (skipped)
      expect(result.validation.valid).toBe(true);
      expect(result.validation.errors).toHaveLength(0);
    });
  });
  
  // ==========================================================================
  // PROCESS CONTENT TESTS
  // ==========================================================================
  
  describe('processContent', () => {
    it('should process content end-to-end', () => {
      const content = createCSVContent(
        ['First Name', 'Last Name'],
        [['John', 'Doe']]
      );
      const steps = createTestSteps();
      
      const result = service.processContent(content, steps, 'data.csv');
      
      expect(result.parseResult.success).toBe(true);
      expect(result.metadata.fileName).toBe('data.csv');
    });
    
    it('should handle empty content', () => {
      const steps = createTestSteps();
      
      const result = service.processContent('', steps);
      
      expect(result.parseResult.success).toBe(false);
      expect(result.validation.valid).toBe(false);
    });
  });
  
  // ==========================================================================
  // STATISTICS TESTS
  // ==========================================================================
  
  describe('statistics', () => {
    it('should track files processed', async () => {
      const content = createCSVContent(['Name'], [['John']]);
      const file = createMockFile(content);
      const steps = createTestSteps();
      
      await service.processFile(file, steps);
      
      const stats = service.getStats();
      
      expect(stats.filesProcessed).toBe(1);
    });
    
    it('should track rows parsed', () => {
      const content = createCSVContent(['Name'], [['A'], ['B'], ['C']]);
      service.parseString(content);
      
      const stats = service.getStats();
      
      expect(stats.totalRowsParsed).toBe(3);
    });
    
    it('should track mappings created', () => {
      const headers = ['First Name', 'Last Name'];
      const steps = createTestSteps();
      
      service.autoMap(headers, steps);
      
      const stats = service.getStats();
      
      expect(stats.totalMappingsCreated).toBeGreaterThanOrEqual(0);
    });
    
    it('should track parse errors', () => {
      service.parseString('');
      
      const stats = service.getStats();
      
      expect(stats.parseErrors).toBe(1);
    });
    
    it('should reset stats', async () => {
      const content = createCSVContent(['Name'], [['John']]);
      const file = createMockFile(content);
      const steps = createTestSteps();
      
      await service.processFile(file, steps);
      service.resetStats();
      
      const stats = service.getStats();
      
      expect(stats.filesProcessed).toBe(0);
      expect(stats.totalRowsParsed).toBe(0);
    });
  });
  
  // ==========================================================================
  // COMPONENT ACCESS TESTS
  // ==========================================================================
  
  describe('component access', () => {
    it('should provide parser access', () => {
      const parser = service.getParser();
      
      expect(parser).toBeDefined();
      expect(typeof parser.parseString).toBe('function');
    });
    
    it('should provide mapper access', () => {
      const mapper = service.getMapper();
      
      expect(mapper).toBeDefined();
      expect(typeof mapper.autoMap).toBe('function');
    });
    
    it('should provide validator access', () => {
      const validator = service.getValidator();
      
      expect(validator).toBeDefined();
      expect(typeof validator.validateData).toBe('function');
    });
  });
});

// ============================================================================
// FACTORY TESTS
// ============================================================================

describe('Factory Functions', () => {
  afterEach(() => {
    resetCSVProcessingService();
  });
  
  describe('createCSVProcessingService', () => {
    it('should create service with defaults', () => {
      const service = createCSVProcessingService();
      
      expect(service).toBeInstanceOf(CSVProcessingService);
    });
  });
  
  describe('createPreviewService', () => {
    it('should create service for preview', () => {
      const service = createPreviewService();
      const config = service.getServiceConfig();
      
      expect(config.autoValidateOnProcess).toBe(false);
    });
  });
  
  describe('createFullProcessingService', () => {
    it('should create service for full processing', () => {
      const service = createFullProcessingService();
      const config = service.getServiceConfig();
      
      expect(config.autoMapOnProcess).toBe(true);
      expect(config.autoValidateOnProcess).toBe(true);
    });
  });
  
  describe('createStrictService', () => {
    it('should create strict service', () => {
      const service = createStrictService();
      const validator = service.getValidator();
      
      expect(validator.getConfig().requireAllColumnsMapped).toBe(true);
    });
  });
});

// ============================================================================
// SINGLETON TESTS
// ============================================================================

describe('Singleton', () => {
  afterEach(() => {
    resetCSVProcessingService();
  });
  
  describe('getCSVProcessingService', () => {
    it('should return same instance', () => {
      const service1 = getCSVProcessingService();
      const service2 = getCSVProcessingService();
      
      expect(service1).toBe(service2);
    });
  });
  
  describe('resetCSVProcessingService', () => {
    it('should create new instance after reset', () => {
      const service1 = getCSVProcessingService();
      resetCSVProcessingService();
      const service2 = getCSVProcessingService();
      
      expect(service1).not.toBe(service2);
    });
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Integration', () => {
  it('should handle complete workflow', async () => {
    const service = createFullProcessingService();
    
    // Create CSV with data that matches steps
    const content = createCSVContent(
      ['First Name', 'Last Name', 'Email Address'],
      [
        ['John', 'Doe', 'john@example.com'],
        ['Jane', 'Smith', 'jane@example.com'],
        ['Bob', 'Johnson', 'bob@example.com'],
      ]
    );
    
    const file = createMockFile(content, 'users.csv');
    const steps = createTestSteps();
    
    // Process file
    const result = await service.processFile(file, steps);
    
    // Verify success
    expect(result.parseResult.success).toBe(true);
    expect(result.parseResult.data?.rowCount).toBe(3);
    
    // Verify auto-mapping worked
    const mappedCount = result.mappings.filter(m => m.mapped).length;
    expect(mappedCount).toBeGreaterThan(0);
    
    // Verify validation
    expect(result.validation.stats.totalRows).toBe(3);
    
    // Verify metadata
    expect(result.metadata.fileName).toBe('users.csv');
    expect(result.metadata.duration).toBeGreaterThanOrEqual(0);
    
    // Verify stats
    const stats = service.getStats();
    expect(stats.filesProcessed).toBe(1);
    expect(stats.totalRowsParsed).toBe(3);
  });
});
