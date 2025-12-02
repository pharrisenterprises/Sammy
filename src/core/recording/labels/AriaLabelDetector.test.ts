/**
 * Tests for AriaLabelDetector
 * @module core/recording/labels/AriaLabelDetector.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  AriaLabelDetector,
  createAriaLabelDetector,
  hasAriaLabel,
  getAriaLabelAttributes,
  resolveAriaLabelledBy,
  getAccessibleName,
  ARIA_CONFIDENCE,
  ARIA_ATTRIBUTES,
  ROLES_WITH_TEXT_LABELS,
} from './AriaLabelDetector';

import {
  createDetectionContext,
  DEFAULT_DETECTION_OPTIONS,
  mergeDetectionOptions,
} from './ILabelDetector';

// ============================================================================
// TEST SETUP
// ============================================================================

describe('AriaLabelDetector', () => {
  let detector: AriaLabelDetector;
  
  beforeEach(() => {
    detector = new AriaLabelDetector();
  });
  
  afterEach(() => {
    // Clean up any elements added to document
    document.body.innerHTML = '';
  });
  
  // ==========================================================================
  // BASIC PROPERTIES
  // ==========================================================================
  
  describe('properties', () => {
    it('should have correct name', () => {
      expect(detector.name).toBe('aria-label');
    });
    
    it('should have correct priority', () => {
      expect(detector.priority).toBe(20); // DETECTOR_PRIORITIES.ARIA
    });
    
    it('should have correct base confidence', () => {
      expect(detector.baseConfidence).toBe(0.90);
    });
    
    it('should have description', () => {
      expect(detector.description).toContain('ARIA');
    });
  });
  
  // ==========================================================================
  // CAN DETECT
  // ==========================================================================
  
  describe('canDetect', () => {
    it('should return true for aria-label', () => {
      const input = document.createElement('input');
      input.setAttribute('aria-label', 'Email');
      
      const context = createDetectionContext(input);
      expect(detector.canDetect(context)).toBe(true);
    });
    
    it('should return true for aria-labelledby', () => {
      const input = document.createElement('input');
      input.setAttribute('aria-labelledby', 'email-label');
      
      const context = createDetectionContext(input);
      expect(detector.canDetect(context)).toBe(true);
    });
    
    it('should return true for aria-describedby', () => {
      const input = document.createElement('input');
      input.setAttribute('aria-describedby', 'email-desc');
      
      const context = createDetectionContext(input);
      expect(detector.canDetect(context)).toBe(true);
    });
    
    it('should return true for aria-placeholder', () => {
      const input = document.createElement('input');
      input.setAttribute('aria-placeholder', 'Enter email');
      
      const context = createDetectionContext(input);
      expect(detector.canDetect(context)).toBe(true);
    });
    
    it('should return true for elements with text label roles', () => {
      const button = document.createElement('div');
      button.setAttribute('role', 'button');
      
      const context = createDetectionContext(button);
      expect(detector.canDetect(context)).toBe(true);
    });
    
    it('should return false for elements without ARIA labels', () => {
      const input = document.createElement('input');
      
      const context = createDetectionContext(input);
      expect(detector.canDetect(context)).toBe(false);
    });
  });
  
  // ==========================================================================
  // ARIA-LABEL DETECTION
  // ==========================================================================
  
  describe('aria-label detection', () => {
    it('should detect aria-label attribute', () => {
      const input = document.createElement('input');
      input.setAttribute('aria-label', 'Email Address');
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result).not.toBeNull();
      expect(result?.label).toBe('Email Address');
      expect(result?.confidence).toBeGreaterThanOrEqual(0.85);
      expect(result?.source.attribute).toBe('aria-label');
    });
    
    it('should clean aria-label text', () => {
      const input = document.createElement('input');
      input.setAttribute('aria-label', '  Email Address *  ');
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('Email Address');
    });
    
    it('should handle empty aria-label', () => {
      const input = document.createElement('input');
      input.setAttribute('aria-label', '');
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result).toBeNull();
    });
    
    it('should apply generic penalty', () => {
      const input = document.createElement('input');
      input.setAttribute('aria-label', 'Input');
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      // Generic label "Input" should have reduced confidence
      expect(result?.confidence).toBeLessThan(0.90);
    });
  });
  
  // ==========================================================================
  // ARIA-LABELLEDBY DETECTION
  // ==========================================================================
  
  describe('aria-labelledby detection', () => {
    it('should detect aria-labelledby reference', () => {
      const label = document.createElement('span');
      label.id = 'email-label';
      label.textContent = 'Email Address';
      document.body.appendChild(label);
      
      const input = document.createElement('input');
      input.setAttribute('aria-labelledby', 'email-label');
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result).not.toBeNull();
      expect(result?.label).toBe('Email Address');
      expect(result?.source.attribute).toBe('aria-labelledby');
    });
    
    it('should handle multiple aria-labelledby IDs', () => {
      const prefix = document.createElement('span');
      prefix.id = 'prefix';
      prefix.textContent = 'Your';
      document.body.appendChild(prefix);
      
      const label = document.createElement('span');
      label.id = 'label';
      label.textContent = 'Email';
      document.body.appendChild(label);
      
      const input = document.createElement('input');
      input.setAttribute('aria-labelledby', 'prefix label');
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('Your Email');
    });
    
    it('should handle missing referenced element', () => {
      const input = document.createElement('input');
      input.setAttribute('aria-labelledby', 'nonexistent-id');
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      // Should fall back to aria-label or return null
      expect(result).toBeNull();
    });
    
    it('should reduce confidence for partial resolution', () => {
      const label = document.createElement('span');
      label.id = 'exists';
      label.textContent = 'Email';
      document.body.appendChild(label);
      
      const input = document.createElement('input');
      input.setAttribute('aria-labelledby', 'exists missing-id');
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('Email');
      // Confidence reduced because only 1 of 2 IDs resolved
      expect(result?.confidence).toBeLessThan(0.90);
    });
    
    it('should prioritize aria-labelledby over aria-label', () => {
      const label = document.createElement('span');
      label.id = 'the-label';
      label.textContent = 'From labelledby';
      document.body.appendChild(label);
      
      const input = document.createElement('input');
      input.setAttribute('aria-labelledby', 'the-label');
      input.setAttribute('aria-label', 'From aria-label');
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('From labelledby');
    });
  });
  
  // ==========================================================================
  // ARIA-DESCRIBEDBY DETECTION
  // ==========================================================================
  
  describe('aria-describedby detection', () => {
    it('should detect aria-describedby as fallback', () => {
      const desc = document.createElement('span');
      desc.id = 'email-desc';
      desc.textContent = 'Enter your email address';
      document.body.appendChild(desc);
      
      const input = document.createElement('input');
      input.setAttribute('aria-describedby', 'email-desc');
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result).not.toBeNull();
      expect(result?.label).toBe('Enter your email address');
      expect(result?.source.attribute).toBe('aria-describedby');
      // Lower confidence than aria-label
      expect(result?.confidence).toBeGreaterThanOrEqual(0.70);
      expect(result?.confidence).toBeLessThanOrEqual(0.85);
    });
    
    it('should extract first phrase from long descriptions', () => {
      const desc = document.createElement('span');
      desc.id = 'long-desc';
      desc.textContent = 'Email Address. Please enter a valid email address that you have access to. We will send a confirmation link to this address.';
      document.body.appendChild(desc);
      
      const input = document.createElement('input');
      input.setAttribute('aria-describedby', 'long-desc');
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      // Should extract first sentence or phrase
      expect(result?.label).toBe('Email Address.');
    });
  });
  
  // ==========================================================================
  // ARIA-PLACEHOLDER DETECTION
  // ==========================================================================
  
  describe('aria-placeholder detection', () => {
    it('should detect aria-placeholder', () => {
      const input = document.createElement('input');
      input.setAttribute('aria-placeholder', 'Enter email here');
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result).not.toBeNull();
      expect(result?.label).toBe('Enter email here');
      expect(result?.source.attribute).toBe('aria-placeholder');
      expect(result?.confidence).toBeGreaterThanOrEqual(0.65);
      expect(result?.confidence).toBeLessThanOrEqual(0.80);
    });
  });
  
  // ==========================================================================
  // ROLE-BASED DETECTION
  // ==========================================================================
  
  describe('role-based detection', () => {
    it('should detect label from button role text', () => {
      const button = document.createElement('div');
      button.setAttribute('role', 'button');
      button.textContent = 'Submit Form';
      document.body.appendChild(button);
      
      const context = createDetectionContext(button);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('Submit Form');
      expect(result?.source.type).toBe('text-content');
    });
    
    it('should detect label from native button', () => {
      const button = document.createElement('button');
      button.textContent = 'Click Me';
      document.body.appendChild(button);
      
      const context = createDetectionContext(button);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('Click Me');
    });
    
    it('should detect label from link', () => {
      const link = document.createElement('a');
      link.textContent = 'Learn More';
      link.href = '#';
      document.body.appendChild(link);
      
      const context = createDetectionContext(link);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('Learn More');
    });
    
    it('should not detect for form control roles without ARIA label', () => {
      const input = document.createElement('input');
      input.type = 'text';
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      // Input without aria-label should not be detected by this detector
      expect(result).toBeNull();
    });
  });
  
  // ==========================================================================
  // SHADOW DOM
  // ==========================================================================
  
  describe('shadow DOM support', () => {
    it('should find aria-labelledby in shadow DOM', () => {
      const host = document.createElement('div');
      const shadow = host.attachShadow({ mode: 'open' });
      
      const label = document.createElement('span');
      label.id = 'shadow-label';
      label.textContent = 'Shadow Label';
      shadow.appendChild(label);
      
      const input = document.createElement('input');
      input.setAttribute('aria-labelledby', 'shadow-label');
      shadow.appendChild(input);
      
      document.body.appendChild(host);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('Shadow Label');
    });
  });
});

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================

describe('createAriaLabelDetector', () => {
  it('should create detector instance', () => {
    const detector = createAriaLabelDetector();
    expect(detector).toBeInstanceOf(AriaLabelDetector);
  });
});

describe('hasAriaLabel', () => {
  it('should return true for aria-label', () => {
    const input = document.createElement('input');
    input.setAttribute('aria-label', 'Test');
    expect(hasAriaLabel(input)).toBe(true);
  });
  
  it('should return true for aria-labelledby', () => {
    const input = document.createElement('input');
    input.setAttribute('aria-labelledby', 'test-id');
    expect(hasAriaLabel(input)).toBe(true);
  });
  
  it('should return false without ARIA label', () => {
    const input = document.createElement('input');
    expect(hasAriaLabel(input)).toBe(false);
  });
});

describe('getAriaLabelAttributes', () => {
  it('should return all ARIA label attributes', () => {
    const input = document.createElement('input');
    input.setAttribute('aria-label', 'Label');
    input.setAttribute('aria-labelledby', 'id1');
    input.setAttribute('aria-describedby', 'id2');
    input.setAttribute('role', 'textbox');
    
    const attrs = getAriaLabelAttributes(input);
    
    expect(attrs['aria-label']).toBe('Label');
    expect(attrs['aria-labelledby']).toBe('id1');
    expect(attrs['aria-describedby']).toBe('id2');
    expect(attrs['role']).toBe('textbox');
  });
});

describe('resolveAriaLabelledBy', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });
  
  it('should resolve labelledby IDs', () => {
    const label = document.createElement('span');
    label.id = 'test-label';
    label.textContent = 'Test Label';
    document.body.appendChild(label);
    
    const input = document.createElement('input');
    input.setAttribute('aria-labelledby', 'test-label');
    
    const text = resolveAriaLabelledBy(input);
    expect(text).toBe('Test Label');
  });
  
  it('should return null for missing element', () => {
    const input = document.createElement('input');
    input.setAttribute('aria-labelledby', 'missing');
    
    const text = resolveAriaLabelledBy(input);
    expect(text).toBeNull();
  });
});

describe('getAccessibleName', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });
  
  it('should prioritize aria-labelledby', () => {
    const label = document.createElement('span');
    label.id = 'the-label';
    label.textContent = 'From labelledby';
    document.body.appendChild(label);
    
    const input = document.createElement('input');
    input.setAttribute('aria-labelledby', 'the-label');
    input.setAttribute('aria-label', 'From aria-label');
    
    const name = getAccessibleName(input);
    expect(name).toBe('From labelledby');
  });
  
  it('should fall back to aria-label', () => {
    const input = document.createElement('input');
    input.setAttribute('aria-label', 'Direct Label');
    
    const name = getAccessibleName(input);
    expect(name).toBe('Direct Label');
  });
  
  it('should return null without ARIA labels', () => {
    const input = document.createElement('input');
    
    const name = getAccessibleName(input);
    expect(name).toBeNull();
  });
});

// ============================================================================
// CONSTANT TESTS
// ============================================================================

describe('ARIA_CONFIDENCE', () => {
  it('should have expected values', () => {
    expect(ARIA_CONFIDENCE.LABELLEDBY).toBe(0.90);
    expect(ARIA_CONFIDENCE.LABEL).toBe(0.90);
    expect(ARIA_CONFIDENCE.DESCRIBEDBY).toBe(0.75);
    expect(ARIA_CONFIDENCE.PLACEHOLDER).toBe(0.70);
  });
});

describe('ARIA_ATTRIBUTES', () => {
  it('should include all expected attributes', () => {
    expect(ARIA_ATTRIBUTES).toContain('aria-labelledby');
    expect(ARIA_ATTRIBUTES).toContain('aria-label');
    expect(ARIA_ATTRIBUTES).toContain('aria-describedby');
    expect(ARIA_ATTRIBUTES).toContain('aria-placeholder');
  });
});

describe('ROLES_WITH_TEXT_LABELS', () => {
  it('should include common interactive roles', () => {
    expect(ROLES_WITH_TEXT_LABELS).toContain('button');
    expect(ROLES_WITH_TEXT_LABELS).toContain('link');
    expect(ROLES_WITH_TEXT_LABELS).toContain('menuitem');
    expect(ROLES_WITH_TEXT_LABELS).toContain('tab');
  });
});
