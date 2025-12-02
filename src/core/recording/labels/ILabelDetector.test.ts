/**
 * Tests for ILabelDetector
 * @module core/recording/labels/ILabelDetector.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BaseLabelDetector,
  normalizeLabel,
  isGenericLabel,
  cleanLabelText,
  getVisibleText,
  isElementVisible,
  createDetectionContext,
  mergeDetectionOptions,
  isLabelDetectionResult,
  isLabelDetector,
  CONFIDENCE_SCORES,
  DETECTOR_PRIORITIES,
  DEFAULT_DETECTION_OPTIONS,
  type ILabelDetector,
  type LabelDetectionContext,
  type LabelDetectionOptions,
  type LabelDetectionResult,
} from './ILabelDetector';

// ============================================================================
// TEST DETECTOR IMPLEMENTATION
// ============================================================================

class TestDetector extends BaseLabelDetector {
  constructor() {
    super('test-detector', 50, 0.75, 'Test detector for unit tests');
  }
  
  canDetect(context: LabelDetectionContext): boolean {
    return context.element.hasAttribute('data-test-label');
  }
  
  protected doDetect(
    context: LabelDetectionContext,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    const label = context.element.getAttribute('data-test-label');
    if (!label) return null;
    
    return this.createResult(label, context.element, 'attribute', {
      attribute: 'data-test-label',
    });
  }
}

// ============================================================================
// BASE LABEL DETECTOR TESTS
// ============================================================================

describe('BaseLabelDetector', () => {
  let detector: TestDetector;
  
  beforeEach(() => {
    detector = new TestDetector();
  });
  
  describe('properties', () => {
    it('should have correct name', () => {
      expect(detector.name).toBe('test-detector');
    });
    
    it('should have correct priority', () => {
      expect(detector.priority).toBe(50);
    });
    
    it('should have correct base confidence', () => {
      expect(detector.baseConfidence).toBe(0.75);
    });
    
    it('should have description', () => {
      expect(detector.description).toBe('Test detector for unit tests');
    });
  });
  
  describe('canDetect', () => {
    it('should return true when element has expected attribute', () => {
      const element = document.createElement('input');
      element.setAttribute('data-test-label', 'Test Label');
      
      const context = createDetectionContext(element);
      
      expect(detector.canDetect(context)).toBe(true);
    });
    
    it('should return false when element lacks expected attribute', () => {
      const element = document.createElement('input');
      
      const context = createDetectionContext(element);
      
      expect(detector.canDetect(context)).toBe(false);
    });
  });
  
  describe('detect', () => {
    it('should detect label from element', () => {
      const element = document.createElement('input');
      element.setAttribute('data-test-label', 'Email Address');
      document.body.appendChild(element);
      
      const context = createDetectionContext(element);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result).not.toBeNull();
      expect(result?.label).toBe('Email Address');
      expect(result?.confidence).toBe(0.75);
      expect(result?.strategy).toBe('test-detector');
      
      document.body.removeChild(element);
    });
    
    it('should return null when no label found', () => {
      const element = document.createElement('input');
      
      const context = createDetectionContext(element);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result).toBeNull();
    });
    
    it('should respect minimum confidence threshold', () => {
      const element = document.createElement('input');
      element.setAttribute('data-test-label', 'Test');
      
      const context = createDetectionContext(element);
      const options = mergeDetectionOptions({ minConfidence: 0.90 });
      
      const result = detector.detect(context, options);
      
      // Base confidence is 0.75, below threshold of 0.90
      expect(result).toBeNull();
    });
    
    it('should normalize label', () => {
      const element = document.createElement('input');
      element.setAttribute('data-test-label', '  Email   Address  ');
      
      const context = createDetectionContext(element);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('Email Address');
    });
    
    it('should truncate long labels', () => {
      const element = document.createElement('input');
      const longLabel = 'A'.repeat(150);
      element.setAttribute('data-test-label', longLabel);
      
      const context = createDetectionContext(element);
      const options = mergeDetectionOptions({ maxLength: 50 });
      
      const result = detector.detect(context, options);
      
      expect(result?.label.length).toBeLessThanOrEqual(50);
      expect(result?.label.endsWith('...')).toBe(true);
      expect(result?.metadata.truncated).toBe(true);
    });
    
    it('should include source metadata', () => {
      const element = document.createElement('input');
      element.setAttribute('data-test-label', 'Test');
      
      const context = createDetectionContext(element);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.source.type).toBe('attribute');
      expect(result?.source.attribute).toBe('data-test-label');
      expect(result?.source.element).toBe(element);
    });
  });
});

// ============================================================================
// NORMALIZE LABEL TESTS
// ============================================================================

describe('normalizeLabel', () => {
  it('should trim whitespace', () => {
    const result = normalizeLabel('  test  ', DEFAULT_DETECTION_OPTIONS);
    expect(result).toBe('test');
  });
  
  it('should normalize internal whitespace', () => {
    const result = normalizeLabel('hello   world', DEFAULT_DETECTION_OPTIONS);
    expect(result).toBe('hello world');
  });
  
  it('should truncate to max length', () => {
    const options = mergeDetectionOptions({ maxLength: 10 });
    const result = normalizeLabel('this is a very long label', options);
    expect(result).toBe('this is...');
  });
  
  it('should apply custom transform', () => {
    const options = mergeDetectionOptions({
      transform: (s) => s.toUpperCase(),
    });
    const result = normalizeLabel('hello', options);
    expect(result).toBe('HELLO');
  });
  
  it('should handle empty string', () => {
    const result = normalizeLabel('', DEFAULT_DETECTION_OPTIONS);
    expect(result).toBe('');
  });
  
  it('should preserve single spaces', () => {
    const result = normalizeLabel('first second', DEFAULT_DETECTION_OPTIONS);
    expect(result).toBe('first second');
  });
});

// ============================================================================
// IS GENERIC LABEL TESTS
// ============================================================================

describe('isGenericLabel', () => {
  it('should identify generic labels', () => {
    expect(isGenericLabel('Input')).toBe(true);
    expect(isGenericLabel('field')).toBe(true);
    expect(isGenericLabel('TEXT')).toBe(true);
    expect(isGenericLabel('Enter')).toBe(true);
    expect(isGenericLabel('Submit')).toBe(true);
    expect(isGenericLabel('*')).toBe(true);
  });
  
  it('should not flag specific labels', () => {
    expect(isGenericLabel('Email Address')).toBe(false);
    expect(isGenericLabel('First Name')).toBe(false);
    expect(isGenericLabel('Phone Number')).toBe(false);
    expect(isGenericLabel('Submit Order')).toBe(false);
  });
});

// ============================================================================
// CLEAN LABEL TEXT TESTS
// ============================================================================

describe('cleanLabelText', () => {
  it('should remove trailing asterisk', () => {
    expect(cleanLabelText('Email *')).toBe('Email');
  });
  
  it('should remove leading asterisk', () => {
    expect(cleanLabelText('* Email')).toBe('Email');
  });
  
  it('should remove trailing colon', () => {
    expect(cleanLabelText('Email:')).toBe('Email');
  });
  
  it('should remove (required)', () => {
    expect(cleanLabelText('Email (required)')).toBe('Email');
  });
  
  it('should remove (optional)', () => {
    expect(cleanLabelText('Email (optional)')).toBe('Email');
  });
  
  it('should normalize whitespace', () => {
    expect(cleanLabelText('Email   Address')).toBe('Email Address');
  });
  
  it('should handle combined cases', () => {
    expect(cleanLabelText('  Email * (required):  ')).toBe('Email');
  });
});

// ============================================================================
// GET VISIBLE TEXT TESTS
// ============================================================================

describe('getVisibleText', () => {
  it('should get text content', () => {
    const div = document.createElement('div');
    div.textContent = 'Hello World';
    document.body.appendChild(div);
    
    const text = getVisibleText(div);
    
    expect(text).toBe('Hello World');
    
    document.body.removeChild(div);
  });
  
  it('should join text from multiple children', () => {
    const div = document.createElement('div');
    const span1 = document.createElement('span');
    span1.textContent = 'Hello';
    const span2 = document.createElement('span');
    span2.textContent = 'World';
    div.appendChild(span1);
    div.appendChild(span2);
    document.body.appendChild(div);
    
    const text = getVisibleText(div);
    
    expect(text).toBe('Hello World');
    
    document.body.removeChild(div);
  });
});

// ============================================================================
// IS ELEMENT VISIBLE TESTS
// ============================================================================

describe('isElementVisible', () => {
  it('should return true for visible elements', () => {
    const div = document.createElement('div');
    div.textContent = 'Test Content'; // Add content to ensure dimensions
    document.body.appendChild(div);
    
    // Mock getBoundingClientRect to simulate visible element
    const originalGetBoundingClientRect = div.getBoundingClientRect;
    div.getBoundingClientRect = vi.fn(() => ({
      width: 100,
      height: 100,
      top: 0,
      left: 0,
      right: 100,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => {},
    })) as any;
    
    expect(isElementVisible(div)).toBe(true);
    
    div.getBoundingClientRect = originalGetBoundingClientRect;
    document.body.removeChild(div);
  });
  
  it('should return false for display:none', () => {
    const div = document.createElement('div');
    div.style.display = 'none';
    document.body.appendChild(div);
    
    expect(isElementVisible(div)).toBe(false);
    
    document.body.removeChild(div);
  });
  
  it('should return false for visibility:hidden', () => {
    const div = document.createElement('div');
    div.style.visibility = 'hidden';
    document.body.appendChild(div);
    
    expect(isElementVisible(div)).toBe(false);
    
    document.body.removeChild(div);
  });
  
  it('should return false for opacity:0', () => {
    const div = document.createElement('div');
    div.style.opacity = '0';
    document.body.appendChild(div);
    
    expect(isElementVisible(div)).toBe(false);
    
    document.body.removeChild(div);
  });
});

// ============================================================================
// CREATE DETECTION CONTEXT TESTS
// ============================================================================

describe('createDetectionContext', () => {
  it('should create context with required fields', () => {
    const element = document.createElement('input');
    document.body.appendChild(element);
    
    const context = createDetectionContext(element);
    
    expect(context.element).toBe(element);
    expect(context.document).toBe(document);
    expect(context.window).toBe(window);
    expect(context.isInIframe).toBe(false);
    expect(context.isInShadowDOM).toBe(false);
    expect(context.pageUrl).toBe(window.location.href);
    
    document.body.removeChild(element);
  });
  
  it('should detect shadow DOM context', () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const input = document.createElement('input');
    shadow.appendChild(input);
    document.body.appendChild(host);
    
    const context = createDetectionContext(input);
    
    expect(context.isInShadowDOM).toBe(true);
    expect(context.shadowRoot).toBe(shadow);
    
    document.body.removeChild(host);
  });
  
  it('should merge extra context', () => {
    const element = document.createElement('input');
    const event = new MouseEvent('click');
    
    const context = createDetectionContext(element, {
      event,
      extra: { custom: 'value' },
    });
    
    expect(context.event).toBe(event);
    expect(context.extra.custom).toBe('value');
  });
});

// ============================================================================
// MERGE DETECTION OPTIONS TESTS
// ============================================================================

describe('mergeDetectionOptions', () => {
  it('should return defaults when no options provided', () => {
    const options = mergeDetectionOptions();
    
    expect(options.maxLength).toBe(DEFAULT_DETECTION_OPTIONS.maxLength);
    expect(options.minConfidence).toBe(DEFAULT_DETECTION_OPTIONS.minConfidence);
    expect(options.normalizeWhitespace).toBe(true);
    expect(options.trim).toBe(true);
  });
  
  it('should merge custom options', () => {
    const options = mergeDetectionOptions({
      maxLength: 50,
      minConfidence: 0.5,
    });
    
    expect(options.maxLength).toBe(50);
    expect(options.minConfidence).toBe(0.5);
    expect(options.normalizeWhitespace).toBe(true); // default preserved
  });
});

// ============================================================================
// TYPE GUARD TESTS
// ============================================================================

describe('isLabelDetectionResult', () => {
  it('should return true for valid result', () => {
    const result: LabelDetectionResult = {
      label: 'Test',
      confidence: 0.8,
      strategy: 'test',
      source: {
        element: null,
        type: 'attribute',
        xpath: null,
        attribute: 'test',
      },
      metadata: {
        rawText: 'Test',
        truncated: false,
        originalLength: 4,
        selector: null,
        framework: null,
        extra: {},
      },
    };
    
    expect(isLabelDetectionResult(result)).toBe(true);
  });
  
  it('should return false for invalid result', () => {
    expect(isLabelDetectionResult(null)).toBe(false);
    expect(isLabelDetectionResult({})).toBe(false);
    expect(isLabelDetectionResult({ label: 'test' })).toBe(false);
    expect(isLabelDetectionResult({ label: 'test', confidence: 1.5 })).toBe(false);
  });
});

describe('isLabelDetector', () => {
  it('should return true for valid detector', () => {
    const detector = new TestDetector();
    expect(isLabelDetector(detector)).toBe(true);
  });
  
  it('should return false for invalid detector', () => {
    expect(isLabelDetector(null)).toBe(false);
    expect(isLabelDetector({})).toBe(false);
    expect(isLabelDetector({ name: 'test' })).toBe(false);
  });
});

// ============================================================================
// CONSTANT TESTS
// ============================================================================

describe('CONFIDENCE_SCORES', () => {
  it('should have all expected scores', () => {
    expect(CONFIDENCE_SCORES.GOOGLE_FORMS).toBe(0.95);
    expect(CONFIDENCE_SCORES.ARIA_LABEL).toBe(0.90);
    expect(CONFIDENCE_SCORES.LABEL_FOR).toBe(0.85);
    expect(CONFIDENCE_SCORES.PLACEHOLDER).toBe(0.70);
    expect(CONFIDENCE_SCORES.FALLBACK).toBe(0.20);
  });
  
  it('should have scores in valid range', () => {
    for (const [, score] of Object.entries(CONFIDENCE_SCORES)) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });
});

describe('DETECTOR_PRIORITIES', () => {
  it('should have framework as highest priority', () => {
    expect(DETECTOR_PRIORITIES.FRAMEWORK).toBeLessThan(DETECTOR_PRIORITIES.ARIA);
    expect(DETECTOR_PRIORITIES.ARIA).toBeLessThan(DETECTOR_PRIORITIES.ATTRIBUTES);
    expect(DETECTOR_PRIORITIES.ATTRIBUTES).toBeLessThan(DETECTOR_PRIORITIES.FALLBACK);
  });
});

describe('DEFAULT_DETECTION_OPTIONS', () => {
  it('should have sensible defaults', () => {
    expect(DEFAULT_DETECTION_OPTIONS.maxLength).toBe(100);
    expect(DEFAULT_DETECTION_OPTIONS.minConfidence).toBe(0);
    expect(DEFAULT_DETECTION_OPTIONS.normalizeWhitespace).toBe(true);
    expect(DEFAULT_DETECTION_OPTIONS.trim).toBe(true);
    expect(DEFAULT_DETECTION_OPTIONS.checkVisibility).toBe(false);
    expect(DEFAULT_DETECTION_OPTIONS.transform).toBeNull();
  });
});
