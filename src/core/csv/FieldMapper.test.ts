/**
 * Tests for FieldMapper
 * @module core/csv/FieldMapper.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  FieldMapper,
  createFieldMapper,
  createStrictMapper,
  createLooseMapper,
  createDuplicateAllowingMapper,
  getFieldMapper,
  resetFieldMapper,
  DEFAULT_FIELD_MAPPER_CONFIG,
} from './FieldMapper';
import type { Step, LocatorBundle } from '../index';
import { createStep, createBundle } from '../index';

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Create a test locator bundle
 */
function createTestBundle(): LocatorBundle {
  return createBundle({
    xpath: '//input',
  });
}

/**
 * Create an input step
 */
function createInputStep(label: string, value: string, bundle: LocatorBundle): Step {
  return createStep({
    event: 'input',
    label,
    value,
    path: bundle.xpath || '',
    x: 0,
    y: 0,
    bundle,
  });
}

/**
 * Create a click step
 */
function createClickStep(label: string, bundle: LocatorBundle): Step {
  return createStep({
    event: 'click',
    label,
    value: '',
    path: bundle.xpath || '',
    x: 0,
    y: 0,
    bundle,
  });
}

/**
 * Create test steps with labels
 */
function createTestSteps(labels: string[]): Step[] {
  return labels.map((label) => 
    createInputStep(label, '', createTestBundle())
  );
}

/**
 * Create mixed steps (input and click)
 */
function createMixedSteps(): Step[] {
  return [
    createInputStep('First Name', '', createTestBundle()),
    createInputStep('Last Name', '', createTestBundle()),
    createInputStep('Email Address', '', createTestBundle()),
    createClickStep('Submit', createTestBundle()),
    createInputStep('Phone Number', '', createTestBundle()),
  ];
}

// ============================================================================
// TESTS
// ============================================================================

describe('FieldMapper', () => {
  let mapper: FieldMapper;
  
  beforeEach(() => {
    mapper = createFieldMapper();
  });
  
  afterEach(() => {
    resetFieldMapper();
  });
  
  // ==========================================================================
  // CONFIGURATION TESTS
  // ==========================================================================
  
  describe('configuration', () => {
    it('should use default config', () => {
      const config = mapper.getMapperConfig();
      
      expect(config.similarityThreshold).toBe(DEFAULT_FIELD_MAPPER_CONFIG.similarityThreshold);
      expect(config.maxAlternatives).toBe(DEFAULT_FIELD_MAPPER_CONFIG.maxAlternatives);
    });
    
    it('should accept custom config', () => {
      const customMapper = createFieldMapper({
        similarityThreshold: 0.5,
        maxAlternatives: 5,
      });
      
      const config = customMapper.getMapperConfig();
      
      expect(config.similarityThreshold).toBe(0.5);
      expect(config.maxAlternatives).toBe(5);
    });
    
    it('should update mapper config', () => {
      mapper.setMapperConfig({ similarityThreshold: 0.6 });
      
      expect(mapper.getMapperConfig().similarityThreshold).toBe(0.6);
    });
    
    it('should sync parser config', () => {
      mapper.setConfig({ similarityThreshold: 0.7 });
      
      expect(mapper.getConfig().similarityThreshold).toBe(0.7);
      expect(mapper.getMapperConfig().similarityThreshold).toBe(0.7);
    });
  });
  
  // ==========================================================================
  // NORMALIZATION TESTS
  // ==========================================================================
  
  describe('normalize', () => {
    it('should lowercase', () => {
      expect(mapper.normalize('HELLO')).toBe('hello');
    });
    
    it('should remove spaces', () => {
      expect(mapper.normalize('first name')).toBe('firstname');
    });
    
    it('should remove underscores', () => {
      expect(mapper.normalize('first_name')).toBe('firstname');
    });
    
    it('should remove hyphens', () => {
      expect(mapper.normalize('first-name')).toBe('firstname');
    });
    
    it('should handle combined transformations', () => {
      expect(mapper.normalize('First_Name Field')).toBe('firstnamefield');
    });
  });
  
  // ==========================================================================
  // SIMILARITY TESTS
  // ==========================================================================
  
  describe('getSimilarity', () => {
    it('should return 1 for identical strings after normalization', () => {
      const score = mapper.getSimilarity('first_name', 'First Name');
      
      expect(score).toBe(1);
    });
    
    it('should return high score for similar strings', () => {
      const score = mapper.getSimilarity('email', 'Email Address');
      
      expect(score).toBeGreaterThan(0.3);
    });
    
    it('should return low score for different strings', () => {
      const score = mapper.getSimilarity('phone', 'email');
      
      expect(score).toBeLessThan(0.3);
    });
    
    it('should return 0 for completely different strings', () => {
      const score = mapper.getSimilarity('abc', 'xyz');
      
      expect(score).toBe(0);
    });
  });
  
  // ==========================================================================
  // AUTO-MAP TESTS
  // ==========================================================================
  
  describe('autoMap', () => {
    it('should map exact matches', () => {
      const headers = ['First Name', 'Last Name', 'Email'];
      const steps = createTestSteps(['First Name', 'Last Name', 'Email']);
      
      const result = mapper.autoMap(headers, steps);
      
      expect(result.mappings.filter(m => m.mapped)).toHaveLength(3);
      expect(result.unmapped).toHaveLength(0);
    });
    
    it('should map with normalization', () => {
      const headers = ['first_name', 'last_name', 'email_address'];
      const steps = createTestSteps(['First Name', 'Last Name', 'Email Address']);
      
      const result = mapper.autoMap(headers, steps);
      
      expect(result.mappings.filter(m => m.mapped)).toHaveLength(3);
    });
    
    it('should handle partial matches', () => {
      const headers = ['email', 'phone'];
      const steps = createTestSteps(['Email Address', 'Phone Number']);
      
      const result = mapper.autoMap(headers, steps);
      
      // At least some should be mapped or suggested
      expect(result.stats.mappedCount + result.suggestions.length).toBeGreaterThan(0);
    });
    
    it('should not map non-input steps', () => {
      const headers = ['First Name', 'Submit'];
      const steps = createMixedSteps();
      
      const result = mapper.autoMap(headers, steps);
      
      // Submit is a click step, shouldn't be mapped
      const submitMapping = result.mappings.find(m => m.csvColumn === 'Submit');
      expect(submitMapping?.stepLabel).not.toBe('Submit');
    });
    
    it('should provide suggestions for low-confidence matches', () => {
      const headers = ['user_email'];
      const steps = createTestSteps(['Email Address', 'Username', 'Contact']);
      
      const result = mapper.autoMap(headers, steps);
      
      // Should have suggestions even if not auto-mapped
      expect(result.suggestions.length + result.stats.mappedCount).toBeGreaterThan(0);
    });
    
    it('should prevent duplicate mappings by default', () => {
      const headers = ['Email', 'email_address', 'user_email'];
      const steps = createTestSteps(['Email']);
      
      const result = mapper.autoMap(headers, steps);
      
      // Only one should be mapped to Email
      const emailMappings = result.mappings.filter(
        m => m.mapped && m.stepLabel === 'Email'
      );
      
      expect(emailMappings.length).toBeLessThanOrEqual(1);
    });
    
    it('should allow duplicate mappings when configured', () => {
      const duplicateMapper = createDuplicateAllowingMapper();
      const headers = ['Email', 'email_address'];
      const steps = createTestSteps(['Email']);
      
      const result = duplicateMapper.autoMap(headers, steps);
      
      // Both could map to Email
      const emailMappings = result.mappings.filter(
        m => m.mapped && m.stepLabel === 'Email'
      );
      
      expect(emailMappings.length).toBeGreaterThanOrEqual(1);
    });
    
    it('should handle empty headers', () => {
      const steps = createTestSteps(['Email']);
      
      const result = mapper.autoMap([], steps);
      
      expect(result.mappings).toHaveLength(0);
      expect(result.stats.totalColumns).toBe(0);
    });
    
    it('should handle empty steps', () => {
      const headers = ['Email', 'Phone'];
      
      const result = mapper.autoMap(headers, []);
      
      expect(result.mappings).toHaveLength(2);
      expect(result.mappings.every(m => !m.mapped)).toBe(true);
    });
    
    it('should calculate statistics', () => {
      const headers = ['First Name', 'Unknown Field'];
      const steps = createTestSteps(['First Name']);
      
      const result = mapper.autoMap(headers, steps);
      
      expect(result.stats.totalColumns).toBe(2);
      expect(result.stats.mappedCount).toBeGreaterThanOrEqual(1);
    });
    
    it('should set autoMapped flag', () => {
      const headers = ['First Name'];
      const steps = createTestSteps(['First Name']);
      
      const result = mapper.autoMap(headers, steps);
      
      const mapping = result.mappings.find(m => m.mapped);
      expect(mapping?.autoMapped).toBe(true);
    });
    
    it('should include confidence score', () => {
      const headers = ['First Name'];
      const steps = createTestSteps(['First Name']);
      
      const result = mapper.autoMap(headers, steps);
      
      const mapping = result.mappings.find(m => m.mapped);
      expect(mapping?.confidence).toBeDefined();
      expect(mapping?.confidence).toBeGreaterThan(0);
    });
  });
  
  // ==========================================================================
  // MANUAL MAPPING TESTS
  // ==========================================================================
  
  describe('createMapping', () => {
    it('should create unmapped field', () => {
      const mapping = mapper.createMapping('Email', null);
      
      expect(mapping.csvColumn).toBe('Email');
      expect(mapping.stepLabel).toBeNull();
      expect(mapping.mapped).toBe(false);
    });
    
    it('should create mapped field', () => {
      const mapping = mapper.createMapping('email', 'Email Address', 2);
      
      expect(mapping.csvColumn).toBe('email');
      expect(mapping.stepLabel).toBe('Email Address');
      expect(mapping.mapped).toBe(true);
      expect(mapping.stepIndex).toBe(2);
    });
    
    it('should calculate confidence for manual mapping', () => {
      const mapping = mapper.createMapping('first_name', 'First Name', 0);
      
      expect(mapping.confidence).toBeDefined();
      expect(mapping.confidence).toBeGreaterThan(0.5);
    });
    
    it('should set autoMapped to false', () => {
      const mapping = mapper.createMapping('Email', 'Email Address');
      
      expect(mapping.autoMapped).toBe(false);
    });
  });
  
  describe('updateMapping', () => {
    it('should update mapping target', () => {
      const original = mapper.createMapping('Email', 'Old Label', 0);
      const updated = mapper.updateMapping(original, 'New Label', 1);
      
      expect(updated.csvColumn).toBe('Email');
      expect(updated.stepLabel).toBe('New Label');
      expect(updated.stepIndex).toBe(1);
    });
  });
  
  describe('clearMapping', () => {
    it('should clear mapping', () => {
      const mapped = mapper.createMapping('Email', 'Email Address', 0);
      const cleared = mapper.clearMapping(mapped);
      
      expect(cleared.csvColumn).toBe('Email');
      expect(cleared.stepLabel).toBeNull();
      expect(cleared.mapped).toBe(false);
    });
  });
  
  // ==========================================================================
  // CONVERSION TESTS
  // ==========================================================================
  
  describe('toFields', () => {
    it('should convert mappings to parsed fields', () => {
      const mappings = [
        mapper.createMapping('email', 'Email Address', 0),
        mapper.createMapping('phone', null),
      ];
      
      const fields = mapper.toFields(mappings);
      
      expect(fields).toHaveLength(2);
      expect(fields[0].inputvarfields).toBe('email');
      expect(fields[0].field_name).toBe('Email Address');
      expect(fields[0].mapped).toBe(true);
      expect(fields[1].mapped).toBe(false);
    });
  });
  
  describe('fromFields', () => {
    it('should convert parsed fields to mappings', () => {
      const fields = [
        {
          field_name: 'Email Address',
          mapped: true,
          inputvarfields: 'email',
        },
      ];
      
      const mappings = mapper.fromFields(fields);
      
      expect(mappings).toHaveLength(1);
      expect(mappings[0].csvColumn).toBe('email');
      expect(mappings[0].stepLabel).toBe('Email Address');
      expect(mappings[0].mapped).toBe(true);
    });
  });
  
  // ==========================================================================
  // UTILITY TESTS
  // ==========================================================================
  
  describe('getBestMatch', () => {
    it('should return best match for column', () => {
      const steps = createTestSteps(['Email Address', 'Phone Number']);
      
      const match = mapper.getBestMatch('email', steps);
      
      expect(match).not.toBeNull();
      expect(match?.suggestedLabel).toBe('Email Address');
    });
    
    it('should return null for no input steps', () => {
      const steps = [createClickStep('Submit', createTestBundle())];
      
      const match = mapper.getBestMatch('email', steps);
      
      expect(match).toBeNull();
    });
  });
  
  describe('getAllMatches', () => {
    it('should return all matches above threshold', () => {
      const steps = createTestSteps(['Email', 'Email Address', 'Contact Email']);
      
      const matches = mapper.getAllMatches('email', steps, 0.1);
      
      expect(matches.length).toBeGreaterThan(0);
    });
  });
  
  describe('validateMappings', () => {
    it('should validate successful mappings', () => {
      const mappings = [
        mapper.createMapping('email', 'Email Address', 0),
        mapper.createMapping('phone', 'Phone Number', 1),
      ];
      
      const validation = mapper.validateMappings(mappings);
      
      expect(validation.valid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });
    
    it('should detect no mappings', () => {
      const mappings = [
        mapper.createMapping('email', null),
        mapper.createMapping('phone', null),
      ];
      
      const validation = mapper.validateMappings(mappings);
      
      expect(validation.valid).toBe(false);
      expect(validation.issues.some(i => i.includes('No fields'))).toBe(true);
    });
    
    it('should detect duplicate mappings', () => {
      const mappings = [
        mapper.createMapping('email', 'Email', 0),
        mapper.createMapping('email2', 'Email', 0), // Same step index
      ];
      
      const validation = mapper.validateMappings(mappings);
      
      expect(validation.valid).toBe(false);
      expect(validation.issues.some(i => i.includes('Duplicate'))).toBe(true);
    });
  });
});

// ============================================================================
// FACTORY TESTS
// ============================================================================

describe('Factory Functions', () => {
  afterEach(() => {
    resetFieldMapper();
  });
  
  describe('createFieldMapper', () => {
    it('should create mapper with defaults', () => {
      const mapper = createFieldMapper();
      
      expect(mapper).toBeInstanceOf(FieldMapper);
    });
  });
  
  describe('createStrictMapper', () => {
    it('should create mapper with 0.5 threshold', () => {
      const mapper = createStrictMapper();
      
      expect(mapper.getMapperConfig().similarityThreshold).toBe(0.5);
    });
  });
  
  describe('createLooseMapper', () => {
    it('should create mapper with 0.2 threshold', () => {
      const mapper = createLooseMapper();
      
      expect(mapper.getMapperConfig().similarityThreshold).toBe(0.2);
      expect(mapper.getMapperConfig().maxAlternatives).toBe(5);
    });
  });
  
  describe('createDuplicateAllowingMapper', () => {
    it('should create mapper allowing duplicates', () => {
      const mapper = createDuplicateAllowingMapper();
      
      expect(mapper.getMapperConfig().allowDuplicates).toBe(true);
    });
  });
});

// ============================================================================
// SINGLETON TESTS
// ============================================================================

describe('Singleton', () => {
  afterEach(() => {
    resetFieldMapper();
  });
  
  describe('getFieldMapper', () => {
    it('should return same instance', () => {
      const mapper1 = getFieldMapper();
      const mapper2 = getFieldMapper();
      
      expect(mapper1).toBe(mapper2);
    });
  });
  
  describe('resetFieldMapper', () => {
    it('should create new instance after reset', () => {
      const mapper1 = getFieldMapper();
      resetFieldMapper();
      const mapper2 = getFieldMapper();
      
      expect(mapper1).not.toBe(mapper2);
    });
  });
});
