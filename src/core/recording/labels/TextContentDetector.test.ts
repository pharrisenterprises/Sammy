/**
 * Tests for TextContentDetector
 * @module core/recording/labels/TextContentDetector.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  TextContentDetector,
  createTextContentDetector,
  extractVisibleText,
  nameToHumanLabel,
  isValidLabelText,
  getPreviousSiblingText,
  TEXT_CONTENT_CONFIDENCE,
  MAX_LABEL_LENGTH,
  MIN_LABEL_LENGTH,
  EXCLUDED_TAGS,
  NON_LABEL_PATTERNS,
} from './TextContentDetector';

import {
  createDetectionContext,
  DEFAULT_DETECTION_OPTIONS,
} from './ILabelDetector';

// ============================================================================
// TEST SETUP
// ============================================================================

describe('TextContentDetector', () => {
  let detector: TextContentDetector;
  
  beforeEach(() => {
    detector = new TextContentDetector();
  });
  
  afterEach(() => {
    document.body.innerHTML = '';
  });
  
  // ==========================================================================
  // BASIC PROPERTIES
  // ==========================================================================
  
  describe('properties', () => {
    it('should have correct name', () => {
      expect(detector.name).toBe('text-content');
    });
    
    it('should have correct priority (low/fallback)', () => {
      expect(detector.priority).toBe(80); // DETECTOR_PRIORITIES.TEXT_CONTENT
    });
    
    it('should have correct base confidence (low)', () => {
      expect(detector.baseConfidence).toBe(0.40);
    });
    
    it('should have description mentioning fallback', () => {
      expect(detector.description?.toLowerCase()).toContain('fallback');
    });
  });
  
  // ==========================================================================
  // CAN DETECT
  // ==========================================================================
  
  describe('canDetect', () => {
    it('should return true for most elements', () => {
      const div = document.createElement('div');
      const context = createDetectionContext(div);
      expect(detector.canDetect(context)).toBe(true);
    });
    
    it('should return false for script elements', () => {
      const script = document.createElement('script');
      const context = createDetectionContext(script);
      expect(detector.canDetect(context)).toBe(false);
    });
    
    it('should return false for style elements', () => {
      const style = document.createElement('style');
      const context = createDetectionContext(style);
      expect(detector.canDetect(context)).toBe(false);
    });
    
    it('should return false for hidden inputs', () => {
      const input = document.createElement('input');
      input.type = 'hidden';
      const context = createDetectionContext(input);
      expect(detector.canDetect(context)).toBe(false);
    });
    
    it('should return true for text inputs', () => {
      const input = document.createElement('input');
      input.type = 'text';
      const context = createDetectionContext(input);
      expect(detector.canDetect(context)).toBe(true);
    });
  });
  
  // ==========================================================================
  // NAME ATTRIBUTE DETECTION
  // ==========================================================================
  
  describe('name attribute detection', () => {
    it('should detect label from name attribute', () => {
      const input = document.createElement('input');
      input.name = 'email';
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result).not.toBeNull();
      expect(result?.label).toBe('Email');
      expect(result?.confidence).toBeGreaterThanOrEqual(TEXT_CONTENT_CONFIDENCE.NAME_ATTRIBUTE);
    });
    
    it('should convert camelCase name to words', () => {
      const input = document.createElement('input');
      input.name = 'firstName';
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('First Name');
    });
    
    it('should convert snake_case name to words', () => {
      const input = document.createElement('input');
      input.name = 'phone_number';
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('Phone Number');
    });
    
    it('should convert kebab-case name to words', () => {
      const input = document.createElement('input');
      input.name = 'street-address';
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('Street Address');
    });
    
    it('should skip generated/hash-like names', () => {
      const input = document.createElement('input');
      input.name = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      // Should fall through to other detection methods or return null
      expect(result?.source.attribute).not.toBe('name');
    });
    
    it('should handle array notation in names', () => {
      const input = document.createElement('input');
      input.name = 'items[0].name';
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('Items Name');
    });
  });
  
  // ==========================================================================
  // VALUE ATTRIBUTE DETECTION
  // ==========================================================================
  
  describe('value attribute detection', () => {
    it('should detect label from submit button value', () => {
      const input = document.createElement('input');
      input.type = 'submit';
      input.value = 'Submit Order';
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('Submit Order');
      expect(result?.source.attribute).toBe('value');
    });
    
    it('should detect label from button input value', () => {
      const input = document.createElement('input');
      input.type = 'button';
      input.value = 'Click Me';
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('Click Me');
    });
    
    it('should not use value for text inputs', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = 'Some Value';
      input.name = 'testField';
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      // Should use name, not value
      expect(result?.source.attribute).not.toBe('value');
    });
  });
  
  // ==========================================================================
  // PREVIOUS SIBLING TEXT DETECTION
  // ==========================================================================
  
  describe('previous sibling text detection', () => {
    it('should detect label from previous text node', () => {
      const container = document.createElement('div');
      container.innerHTML = 'Username: <input type="text">';
      document.body.appendChild(container);
      
      const input = container.querySelector('input')!;
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('Username');
    });
    
    it('should detect label from previous span', () => {
      const container = document.createElement('div');
      const span = document.createElement('span');
      span.textContent = 'Password';
      container.appendChild(span);
      
      const input = document.createElement('input');
      container.appendChild(input);
      document.body.appendChild(container);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('Password');
    });
    
    it('should stop at interactive element siblings', () => {
      const container = document.createElement('div');
      const span = document.createElement('span');
      span.textContent = 'Label Text';
      container.appendChild(span);
      
      const button = document.createElement('button');
      button.textContent = 'Button';
      container.appendChild(button);
      
      const input = document.createElement('input');
      container.appendChild(input);
      document.body.appendChild(container);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      // Should stop at button for sibling detection
      // May still find via parent text (fallback)
      if (result?.source.type === 'sibling') {
        expect(result.label).not.toBe('Label Text');
      }
    });
  });
  
  // ==========================================================================
  // SELF TEXT DETECTION
  // ==========================================================================
  
  describe('self text detection', () => {
    it('should detect button text content', () => {
      const button = document.createElement('button');
      button.textContent = 'Save Changes';
      document.body.appendChild(button);
      
      const context = createDetectionContext(button);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('Save Changes');
    });
    
    it('should detect link text content', () => {
      const link = document.createElement('a');
      link.textContent = 'Learn More';
      link.href = '#';
      document.body.appendChild(link);
      
      const context = createDetectionContext(link);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('Learn More');
    });
    
    it('should not use input text content as label', () => {
      const input = document.createElement('input');
      input.value = 'Some Value';
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      // Should not return self text for inputs
      expect(result?.source.type).not.toBe('text-content');
    });
    
    it('should exclude nested interactive elements', () => {
      const div = document.createElement('div');
      div.innerHTML = 'Label Text <button>Nested Button</button>';
      document.body.appendChild(div);
      
      const context = createDetectionContext(div);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('Label Text');
      expect(result?.label).not.toContain('Nested Button');
    });
    
    it('should have higher confidence for buttons', () => {
      const button = document.createElement('button');
      button.textContent = 'Save Order';
      document.body.appendChild(button);
      
      const context = createDetectionContext(button);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      // Buttons should have higher confidence than base
      expect(result?.confidence).toBeGreaterThan(TEXT_CONTENT_CONFIDENCE.SELF_TEXT);
    });
  });
  
  // ==========================================================================
  // PARENT TEXT DETECTION
  // ==========================================================================
  
  describe('parent text detection', () => {
    it('should detect label from parent element', () => {
      const div = document.createElement('div');
      const text = document.createTextNode('Field Label ');
      div.appendChild(text);
      
      const input = document.createElement('input');
      div.appendChild(input);
      document.body.appendChild(div);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('Field Label');
    });
    
    it('should not use body as label source', () => {
      const input = document.createElement('input');
      document.body.textContent = 'Body Text ';
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.source.type).not.toBe('ancestor');
    });
    
    it('should skip large container parents', () => {
      const main = document.createElement('main');
      const text = document.createTextNode('Main Section Text ');
      main.appendChild(text);
      
      const input = document.createElement('input');
      main.appendChild(input);
      document.body.appendChild(main);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      // Should not use main element text
      expect(result?.metadata?.extra?.parentTag).not.toBe('main');
    });
  });
  
  // ==========================================================================
  // VALIDATION
  // ==========================================================================
  
  describe('validation', () => {
    it('should reject very short text', () => {
      const button = document.createElement('button');
      button.textContent = 'X';
      document.body.appendChild(button);
      
      const context = createDetectionContext(button);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result).toBeNull();
    });
    
    it('should reject very long text', () => {
      const button = document.createElement('button');
      button.textContent = 'A'.repeat(150);
      document.body.appendChild(button);
      
      const context = createDetectionContext(button);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result).toBeNull();
    });
    
    it('should reject numeric-only text', () => {
      const button = document.createElement('button');
      button.textContent = '12345';
      document.body.appendChild(button);
      
      const context = createDetectionContext(button);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result).toBeNull();
    });
    
    it('should reject URL text', () => {
      const link = document.createElement('a');
      link.textContent = 'https://example.com';
      link.href = '#';
      document.body.appendChild(link);
      
      const context = createDetectionContext(link);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result).toBeNull();
    });
    
    it('should reject generic labels', () => {
      const button = document.createElement('button');
      button.textContent = 'Submit';
      document.body.appendChild(button);
      
      const context = createDetectionContext(button);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      // Generic "Submit" should have reduced confidence
      if (result) {
        expect(result.confidence).toBeLessThan(TEXT_CONTENT_CONFIDENCE.SELF_TEXT + 0.10);
      }
    });
  });
  
  // ==========================================================================
  // CONFIDENCE ADJUSTMENTS
  // ==========================================================================
  
  describe('confidence adjustments', () => {
    it('should have lower confidence for parent text', () => {
      const div = document.createElement('div');
      div.innerHTML = 'Parent Label <input>';
      document.body.appendChild(div);
      
      const input = div.querySelector('input')!;
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      if (result?.source.type === 'ancestor') {
        expect(result.confidence).toBeLessThanOrEqual(TEXT_CONTENT_CONFIDENCE.PARENT_TEXT);
      }
    });
  });
});

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================

describe('createTextContentDetector', () => {
  it('should create detector instance', () => {
    const detector = createTextContentDetector();
    expect(detector).toBeInstanceOf(TextContentDetector);
  });
});

describe('nameToHumanLabel', () => {
  it('should convert camelCase', () => {
    expect(nameToHumanLabel('firstName')).toBe('First Name');
  });
  
  it('should convert snake_case', () => {
    expect(nameToHumanLabel('last_name')).toBe('Last Name');
  });
  
  it('should convert kebab-case', () => {
    expect(nameToHumanLabel('email-address')).toBe('Email Address');
  });
  
  it('should handle single word', () => {
    expect(nameToHumanLabel('email')).toBe('Email');
  });
  
  it('should return empty for hash-like names', () => {
    expect(nameToHumanLabel('a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9')).toBe('');
  });
});

describe('isValidLabelText', () => {
  it('should accept normal text', () => {
    expect(isValidLabelText('Email Address')).toBe(true);
  });
  
  it('should reject very short text', () => {
    expect(isValidLabelText('X')).toBe(false);
  });
  
  it('should reject URLs', () => {
    expect(isValidLabelText('https://example.com')).toBe(false);
  });
  
  it('should reject numbers only', () => {
    expect(isValidLabelText('12345')).toBe(false);
  });
});

describe('getPreviousSiblingText', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });
  
  it('should get text from previous sibling', () => {
    const container = document.createElement('div');
    container.innerHTML = 'Label Text <input>';
    document.body.appendChild(container);
    
    const input = container.querySelector('input')!;
    const text = getPreviousSiblingText(input);
    
    expect(text).toBe('Label Text');
  });
  
  it('should return null when no text sibling', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    
    const text = getPreviousSiblingText(input);
    
    expect(text).toBeNull();
  });
});

// ============================================================================
// CONSTANT TESTS
// ============================================================================

describe('TEXT_CONTENT_CONFIDENCE', () => {
  it('should have expected values in descending order', () => {
    expect(TEXT_CONTENT_CONFIDENCE.NAME_ATTRIBUTE).toBe(0.65);
    expect(TEXT_CONTENT_CONFIDENCE.VALUE_ATTRIBUTE).toBe(0.55);
    expect(TEXT_CONTENT_CONFIDENCE.PREVIOUS_TEXT).toBe(0.50);
    expect(TEXT_CONTENT_CONFIDENCE.SELF_TEXT).toBe(0.40);
    expect(TEXT_CONTENT_CONFIDENCE.PARENT_TEXT).toBe(0.35);
  });
  
  it('should have minimum floor', () => {
    expect(TEXT_CONTENT_CONFIDENCE.MINIMUM).toBeLessThan(TEXT_CONTENT_CONFIDENCE.PARENT_TEXT);
  });
});

describe('EXCLUDED_TAGS', () => {
  it('should include non-text elements', () => {
    expect(EXCLUDED_TAGS).toContain('script');
    expect(EXCLUDED_TAGS).toContain('style');
    expect(EXCLUDED_TAGS).toContain('svg');
    expect(EXCLUDED_TAGS).toContain('iframe');
  });
});

describe('NON_LABEL_PATTERNS', () => {
  it('should match numbers only', () => {
    const numberPattern = NON_LABEL_PATTERNS.find(p => p.test('12345'));
    expect(numberPattern).toBeDefined();
  });
  
  it('should match URLs', () => {
    const urlPattern = NON_LABEL_PATTERNS.find(p => p.test('https://example.com'));
    expect(urlPattern).toBeDefined();
  });
});
