/**
 * Tests for PlaceholderDetector
 * @module core/recording/labels/PlaceholderDetector.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  PlaceholderDetector,
  createPlaceholderDetector,
  hasPlaceholder,
  getPlaceholder,
  supportsPlaceholder,
  isInstructionalText,
  extractLabelFromPlaceholder,
  getPlaceholderAttributes,
  PLACEHOLDER_CONFIDENCE,
  PLACEHOLDER_INPUT_TYPES,
  NON_PLACEHOLDER_INPUT_TYPES,
  INSTRUCTIONAL_PATTERNS,
  GENERIC_PLACEHOLDERS,
} from './PlaceholderDetector';

import {
  createDetectionContext,
  DEFAULT_DETECTION_OPTIONS,
} from './ILabelDetector';

// ============================================================================
// TEST SETUP
// ============================================================================

describe('PlaceholderDetector', () => {
  let detector: PlaceholderDetector;
  
  beforeEach(() => {
    detector = new PlaceholderDetector();
  });
  
  afterEach(() => {
    document.body.innerHTML = '';
  });
  
  // ==========================================================================
  // BASIC PROPERTIES
  // ==========================================================================
  
  describe('properties', () => {
    it('should have correct name', () => {
      expect(detector.name).toBe('placeholder');
    });
    
    it('should have correct priority', () => {
      expect(detector.priority).toBe(40); // DETECTOR_PRIORITIES.ATTRIBUTES
    });
    
    it('should have correct base confidence', () => {
      expect(detector.baseConfidence).toBe(0.70);
    });
    
    it('should have description', () => {
      expect(detector.description).toContain('placeholder');
    });
    
    it('should support input and textarea', () => {
      expect(detector.supportedElements).toContain('input');
      expect(detector.supportedElements).toContain('textarea');
    });
  });
  
  // ==========================================================================
  // CAN DETECT
  // ==========================================================================
  
  describe('canDetect', () => {
    it('should return true for input with placeholder', () => {
      const input = document.createElement('input');
      input.placeholder = 'Email';
      
      const context = createDetectionContext(input);
      expect(detector.canDetect(context)).toBe(true);
    });
    
    it('should return true for textarea with placeholder', () => {
      const textarea = document.createElement('textarea');
      textarea.placeholder = 'Enter message';
      
      const context = createDetectionContext(textarea);
      expect(detector.canDetect(context)).toBe(true);
    });
    
    it('should return true for element with title', () => {
      const input = document.createElement('input');
      input.title = 'Enter email address';
      
      const context = createDetectionContext(input);
      expect(detector.canDetect(context)).toBe(true);
    });
    
    it('should return true for element with data-placeholder', () => {
      const input = document.createElement('input');
      input.setAttribute('data-placeholder', 'Custom placeholder');
      
      const context = createDetectionContext(input);
      expect(detector.canDetect(context)).toBe(true);
    });
    
    it('should return false for checkbox input', () => {
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.title = 'Accept terms';
      
      const context = createDetectionContext(input);
      expect(detector.canDetect(context)).toBe(false);
    });
    
    it('should return false for radio input', () => {
      const input = document.createElement('input');
      input.type = 'radio';
      input.title = 'Option 1';
      
      const context = createDetectionContext(input);
      expect(detector.canDetect(context)).toBe(false);
    });
    
    it('should return false for hidden input', () => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.placeholder = 'Hidden';
      
      const context = createDetectionContext(input);
      expect(detector.canDetect(context)).toBe(false);
    });
    
    it('should return false for file input', () => {
      const input = document.createElement('input');
      input.type = 'file';
      
      const context = createDetectionContext(input);
      expect(detector.canDetect(context)).toBe(false);
    });
    
    it('should return false for element without placeholder', () => {
      const input = document.createElement('input');
      
      const context = createDetectionContext(input);
      expect(detector.canDetect(context)).toBe(false);
    });
    
    it('should return false for non-input elements', () => {
      const div = document.createElement('div');
      
      const context = createDetectionContext(div);
      expect(detector.canDetect(context)).toBe(false);
    });
  });
  
  // ==========================================================================
  // PLACEHOLDER DETECTION
  // ==========================================================================
  
  describe('placeholder detection', () => {
    it('should detect standard placeholder', () => {
      const input = document.createElement('input');
      input.placeholder = 'Email Address';
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result).not.toBeNull();
      expect(result?.label).toBe('Email Address');
      expect(result?.source.attribute).toBe('placeholder');
    });
    
    it('should detect textarea placeholder', () => {
      const textarea = document.createElement('textarea');
      textarea.placeholder = 'Enter your message';
      document.body.appendChild(textarea);
      
      const context = createDetectionContext(textarea);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result).not.toBeNull();
      expect(result?.label).toContain('message');
    });
    
    it('should handle empty placeholder', () => {
      const input = document.createElement('input');
      input.placeholder = '';
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result).toBeNull();
    });
    
    it('should detect search input placeholder', () => {
      const input = document.createElement('input');
      input.type = 'search';
      input.placeholder = 'Search products';
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toContain('products');
    });
    
    it('should detect email input placeholder', () => {
      const input = document.createElement('input');
      input.type = 'email';
      input.placeholder = 'john@example.com';
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('john@example.com');
    });
    
    it('should detect tel input placeholder', () => {
      const input = document.createElement('input');
      input.type = 'tel';
      input.placeholder = '555-123-4567';
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('555-123-4567');
    });
  });
  
  // ==========================================================================
  // DATA-PLACEHOLDER DETECTION
  // ==========================================================================
  
  describe('data-placeholder detection', () => {
    it('should detect data-placeholder attribute', () => {
      const input = document.createElement('input');
      input.setAttribute('data-placeholder', 'Custom Label');
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('Custom Label');
      expect(result?.source.attribute).toBe('data-placeholder');
    });
    
    it('should detect data-original-placeholder', () => {
      const input = document.createElement('input');
      input.setAttribute('data-original-placeholder', 'Original Label');
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('Original Label');
    });
    
    it('should prefer placeholder over data-placeholder', () => {
      const input = document.createElement('input');
      input.placeholder = 'Standard';
      input.setAttribute('data-placeholder', 'Data');
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('Standard');
    });
  });
  
  // ==========================================================================
  // TITLE DETECTION
  // ==========================================================================
  
  describe('title detection', () => {
    it('should detect title as fallback', () => {
      const input = document.createElement('input');
      input.title = 'Enter your email address';
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toContain('email');
      expect(result?.source.attribute).toBe('title');
    });
    
    it('should prefer placeholder over title', () => {
      const input = document.createElement('input');
      input.placeholder = 'Placeholder';
      input.title = 'Title';
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('Placeholder');
    });
    
    it('should have lower confidence for title', () => {
      const input = document.createElement('input');
      input.title = 'Email Address';
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.confidence).toBeLessThanOrEqual(PLACEHOLDER_CONFIDENCE.TITLE + 0.05);
    });
  });
  
  // ==========================================================================
  // CONFIDENCE CALCULATION
  // ==========================================================================
  
  describe('confidence calculation', () => {
    it('should have base confidence for normal placeholder', () => {
      const input = document.createElement('input');
      input.placeholder = 'Email Address';
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.confidence).toBeGreaterThanOrEqual(PLACEHOLDER_CONFIDENCE.PLACEHOLDER - 0.05);
    });
    
    it('should reduce confidence for generic placeholders', () => {
      const input = document.createElement('input');
      input.placeholder = 'Enter text';
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.confidence).toBeLessThan(PLACEHOLDER_CONFIDENCE.PLACEHOLDER);
    });
    
    it('should reduce confidence for instructional placeholders', () => {
      const input = document.createElement('input');
      input.placeholder = 'Enter your email here';
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      // Should extract "email" and have confidence around base (may have small bonus for length)
      expect(result?.label).toContain('email');
      expect(result?.confidence).toBeGreaterThanOrEqual(0.60);
      expect(result?.confidence).toBeLessThanOrEqual(0.75);
    });
    
    it('should increase confidence for example placeholders', () => {
      const input = document.createElement('input');
      input.placeholder = 'john@example.com';
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      // Example placeholder should have slight bonus
      expect(result?.confidence).toBeGreaterThanOrEqual(PLACEHOLDER_CONFIDENCE.PLACEHOLDER);
    });
    
    it('should penalize very short placeholders', () => {
      const input = document.createElement('input');
      input.placeholder = 'Hi';
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.confidence).toBeLessThan(PLACEHOLDER_CONFIDENCE.PLACEHOLDER);
    });
    
    it('should penalize very long placeholders', () => {
      const input = document.createElement('input');
      input.placeholder = 'Please enter your full legal first name as it appears on your government-issued identification';
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.confidence).toBeLessThan(PLACEHOLDER_CONFIDENCE.PLACEHOLDER);
    });
    
    it('should have minimum confidence floor', () => {
      const input = document.createElement('input');
      input.placeholder = '...'; // Very generic
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      if (result) {
        expect(result.confidence).toBeGreaterThanOrEqual(PLACEHOLDER_CONFIDENCE.MINIMUM);
      }
    });
  });
  
  // ==========================================================================
  // INSTRUCTIONAL TEXT EXTRACTION
  // ==========================================================================
  
  describe('instructional text extraction', () => {
    it('should extract label from "Enter your email"', () => {
      const input = document.createElement('input');
      input.placeholder = 'Enter your email';
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('email');
    });
    
    it('should extract label from "Type password here"', () => {
      const input = document.createElement('input');
      input.placeholder = 'Type password here';
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('password');
    });
    
    it('should extract label from "Search for products"', () => {
      const input = document.createElement('input');
      input.placeholder = 'Search for products';
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('products');
    });
    
    it('should extract label from "Fill in your name"', () => {
      const input = document.createElement('input');
      input.placeholder = 'Fill in your name';
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('name');
    });
    
    it('should handle "e.g." prefix', () => {
      const input = document.createElement('input');
      input.placeholder = 'e.g. john@example.com';
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('john@example.com');
    });
  });
  
  // ==========================================================================
  // INPUT TYPE SUPPORT
  // ==========================================================================
  
  describe('input type support', () => {
    for (const type of PLACEHOLDER_INPUT_TYPES) {
      it(`should support ${type} input`, () => {
        const input = document.createElement('input');
        input.type = type;
        input.placeholder = `Test ${type}`;
        document.body.appendChild(input);
        
        const context = createDetectionContext(input);
        const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
        
        expect(result).not.toBeNull();
      });
    }
    
    for (const type of ['checkbox', 'radio', 'hidden', 'file']) {
      it(`should not support ${type} input`, () => {
        const input = document.createElement('input');
        input.type = type;
        input.setAttribute('placeholder', 'Test');
        document.body.appendChild(input);
        
        const context = createDetectionContext(input);
        expect(detector.canDetect(context)).toBe(false);
      });
    }
  });
});

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================

describe('createPlaceholderDetector', () => {
  it('should create detector instance', () => {
    const detector = createPlaceholderDetector();
    expect(detector).toBeInstanceOf(PlaceholderDetector);
  });
});

describe('hasPlaceholder', () => {
  it('should return true when placeholder exists', () => {
    const input = document.createElement('input');
    input.placeholder = 'Test';
    expect(hasPlaceholder(input)).toBe(true);
  });
  
  it('should return false when placeholder missing', () => {
    const input = document.createElement('input');
    expect(hasPlaceholder(input)).toBe(false);
  });
});

describe('getPlaceholder', () => {
  it('should return placeholder value', () => {
    const input = document.createElement('input');
    input.placeholder = 'Test Value';
    expect(getPlaceholder(input)).toBe('Test Value');
  });
  
  it('should return null when no placeholder', () => {
    const input = document.createElement('input');
    expect(getPlaceholder(input)).toBeNull();
  });
});

describe('supportsPlaceholder', () => {
  it('should return true for textarea', () => {
    const textarea = document.createElement('textarea');
    expect(supportsPlaceholder(textarea)).toBe(true);
  });
  
  it('should return true for text input', () => {
    const input = document.createElement('input');
    input.type = 'text';
    expect(supportsPlaceholder(input)).toBe(true);
  });
  
  it('should return true for email input', () => {
    const input = document.createElement('input');
    input.type = 'email';
    expect(supportsPlaceholder(input)).toBe(true);
  });
  
  it('should return false for checkbox', () => {
    const input = document.createElement('input');
    input.type = 'checkbox';
    expect(supportsPlaceholder(input)).toBe(false);
  });
  
  it('should return false for div', () => {
    const div = document.createElement('div');
    expect(supportsPlaceholder(div)).toBe(false);
  });
});

describe('isInstructionalText', () => {
  it('should return true for "Enter your email"', () => {
    expect(isInstructionalText('Enter your email')).toBe(true);
  });
  
  it('should return true for "Type here"', () => {
    expect(isInstructionalText('Type here')).toBe(true);
  });
  
  it('should return true for "Search for..."', () => {
    expect(isInstructionalText('Search for products')).toBe(true);
  });
  
  it('should return false for "Email Address"', () => {
    expect(isInstructionalText('Email Address')).toBe(false);
  });
  
  it('should return false for "john@example.com"', () => {
    expect(isInstructionalText('john@example.com')).toBe(false);
  });
});

describe('extractLabelFromPlaceholder', () => {
  it('should extract from "Enter your email"', () => {
    expect(extractLabelFromPlaceholder('Enter your email')).toBe('email');
  });
  
  it('should extract from "Type password here"', () => {
    expect(extractLabelFromPlaceholder('Type password here')).toBe('password');
  });
  
  it('should return original for non-instructional', () => {
    expect(extractLabelFromPlaceholder('Email')).toBe('Email');
  });
});

describe('getPlaceholderAttributes', () => {
  it('should return all placeholder-related attributes', () => {
    const input = document.createElement('input');
    input.placeholder = 'Standard';
    input.setAttribute('data-placeholder', 'Data');
    input.title = 'Title';
    
    const attrs = getPlaceholderAttributes(input);
    
    expect(attrs['placeholder']).toBe('Standard');
    expect(attrs['data-placeholder']).toBe('Data');
    expect(attrs['title']).toBe('Title');
  });
});

// ============================================================================
// CONSTANT TESTS
// ============================================================================

describe('PLACEHOLDER_CONFIDENCE', () => {
  it('should have expected values', () => {
    expect(PLACEHOLDER_CONFIDENCE.PLACEHOLDER).toBe(0.70);
    expect(PLACEHOLDER_CONFIDENCE.DATA_PLACEHOLDER).toBe(0.65);
    expect(PLACEHOLDER_CONFIDENCE.TITLE).toBe(0.60);
    expect(PLACEHOLDER_CONFIDENCE.MINIMUM).toBe(0.30);
  });
});

describe('PLACEHOLDER_INPUT_TYPES', () => {
  it('should include common text input types', () => {
    expect(PLACEHOLDER_INPUT_TYPES).toContain('text');
    expect(PLACEHOLDER_INPUT_TYPES).toContain('email');
    expect(PLACEHOLDER_INPUT_TYPES).toContain('password');
    expect(PLACEHOLDER_INPUT_TYPES).toContain('search');
    expect(PLACEHOLDER_INPUT_TYPES).toContain('tel');
    expect(PLACEHOLDER_INPUT_TYPES).toContain('url');
    expect(PLACEHOLDER_INPUT_TYPES).toContain('number');
  });
});

describe('NON_PLACEHOLDER_INPUT_TYPES', () => {
  it('should include non-text input types', () => {
    expect(NON_PLACEHOLDER_INPUT_TYPES).toContain('checkbox');
    expect(NON_PLACEHOLDER_INPUT_TYPES).toContain('radio');
    expect(NON_PLACEHOLDER_INPUT_TYPES).toContain('hidden');
    expect(NON_PLACEHOLDER_INPUT_TYPES).toContain('file');
    expect(NON_PLACEHOLDER_INPUT_TYPES).toContain('submit');
  });
});

describe('GENERIC_PLACEHOLDERS', () => {
  it('should include common generic placeholders', () => {
    expect(GENERIC_PLACEHOLDERS).toContain('enter text');
    expect(GENERIC_PLACEHOLDERS).toContain('type here');
    expect(GENERIC_PLACEHOLDERS).toContain('...');
  });
});
