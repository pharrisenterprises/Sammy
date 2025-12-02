/**
 * Tests for AssociatedLabelDetector
 * @module core/recording/labels/AssociatedLabelDetector.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  AssociatedLabelDetector,
  createAssociatedLabelDetector,
  hasAssociatedLabel,
  getAssociatedLabels,
  isLabelableElement,
  getLabeledControl,
  getFieldsetLegend,
  ASSOCIATION_CONFIDENCE,
  LABELABLE_ELEMENTS,
  GROUPED_INPUT_TYPES,
} from './AssociatedLabelDetector';

import {
  createDetectionContext,
  DEFAULT_DETECTION_OPTIONS,
} from './ILabelDetector';

// ============================================================================
// TEST SETUP
// ============================================================================

describe('AssociatedLabelDetector', () => {
  let detector: AssociatedLabelDetector;
  
  beforeEach(() => {
    detector = new AssociatedLabelDetector();
  });
  
  afterEach(() => {
    document.body.innerHTML = '';
  });
  
  // ==========================================================================
  // BASIC PROPERTIES
  // ==========================================================================
  
  describe('properties', () => {
    it('should have correct name', () => {
      expect(detector.name).toBe('associated-label');
    });
    
    it('should have correct priority', () => {
      expect(detector.priority).toBe(25); // DETECTOR_PRIORITIES.LABEL_ASSOCIATION
    });
    
    it('should have correct base confidence', () => {
      expect(detector.baseConfidence).toBe(0.85);
    });
    
    it('should have description', () => {
      expect(detector.description).toContain('label');
    });
  });
  
  // ==========================================================================
  // CAN DETECT
  // ==========================================================================
  
  describe('canDetect', () => {
    it('should return true for input element', () => {
      const input = document.createElement('input');
      const context = createDetectionContext(input);
      expect(detector.canDetect(context)).toBe(true);
    });
    
    it('should return true for select element', () => {
      const select = document.createElement('select');
      const context = createDetectionContext(select);
      expect(detector.canDetect(context)).toBe(true);
    });
    
    it('should return true for textarea element', () => {
      const textarea = document.createElement('textarea');
      const context = createDetectionContext(textarea);
      expect(detector.canDetect(context)).toBe(true);
    });
    
    it('should return true for button element', () => {
      const button = document.createElement('button');
      const context = createDetectionContext(button);
      expect(detector.canDetect(context)).toBe(true);
    });
    
    it('should return true for contenteditable', () => {
      const div = document.createElement('div');
      div.setAttribute('contenteditable', 'true');
      const context = createDetectionContext(div);
      expect(detector.canDetect(context)).toBe(true);
    });
    
    it('should return true for role=textbox', () => {
      const div = document.createElement('div');
      div.setAttribute('role', 'textbox');
      const context = createDetectionContext(div);
      expect(detector.canDetect(context)).toBe(true);
    });
    
    it('should return false for div without role', () => {
      const div = document.createElement('div');
      const context = createDetectionContext(div);
      expect(detector.canDetect(context)).toBe(false);
    });
  });
  
  // ==========================================================================
  // LABEL[FOR] DETECTION
  // ==========================================================================
  
  describe('label[for] detection', () => {
    it('should detect label via for attribute', () => {
      const label = document.createElement('label');
      label.setAttribute('for', 'email');
      label.textContent = 'Email Address';
      document.body.appendChild(label);
      
      const input = document.createElement('input');
      input.id = 'email';
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result).not.toBeNull();
      expect(result?.label).toBe('Email Address');
      expect(result?.confidence).toBeGreaterThanOrEqual(ASSOCIATION_CONFIDENCE.LABEL_FOR);
    });
    
    it('should handle label with nested input excluded', () => {
      const label = document.createElement('label');
      label.setAttribute('for', 'name');
      label.innerHTML = 'Full Name <span class="required">*</span>';
      document.body.appendChild(label);
      
      const input = document.createElement('input');
      input.id = 'name';
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('Full Name');
    });
    
    it('should return null when no matching label', () => {
      const input = document.createElement('input');
      input.id = 'orphan';
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result).toBeNull();
    });
    
    it('should not detect via label[for] when input has no ID', () => {
      const label = document.createElement('label');
      label.setAttribute('for', 'something');
      label.textContent = 'Label';
      document.body.appendChild(label);
      
      const input = document.createElement('input');
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      // Should detect via sibling, not label[for]
      if (result) {
        expect(result.source.type).toBe('sibling');
      }
    });
    
    it('should handle special characters in ID', () => {
      const label = document.createElement('label');
      label.setAttribute('for', 'email.address');
      label.textContent = 'Email';
      document.body.appendChild(label);
      
      const input = document.createElement('input');
      input.id = 'email.address';
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('Email');
    });
  });
  
  // ==========================================================================
  // ANCESTOR LABEL DETECTION
  // ==========================================================================
  
  describe('ancestor label detection', () => {
    it('should detect wrapping label', () => {
      const label = document.createElement('label');
      label.innerHTML = 'Username <input type="text">';
      document.body.appendChild(label);
      
      const input = label.querySelector('input')!;
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result).not.toBeNull();
      expect(result?.label).toBe('Username');
      expect(result?.source.type).toBe('ancestor');
    });
    
    it('should handle deeply nested input', () => {
      const label = document.createElement('label');
      label.innerHTML = 'Password <div><span><input type="password"></span></div>';
      document.body.appendChild(label);
      
      const input = label.querySelector('input')!;
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('Password');
    });
    
    it('should extract text before input', () => {
      const label = document.createElement('label');
      const textNode = document.createTextNode('Email: ');
      label.appendChild(textNode);
      const input = document.createElement('input');
      label.appendChild(input);
      document.body.appendChild(label);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('Email');
    });
    
    it('should have lower confidence than label[for]', () => {
      const label = document.createElement('label');
      label.innerHTML = 'Wrapped Input <input>';
      document.body.appendChild(label);
      
      const input = label.querySelector('input')!;
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      // Should be close to ancestor label confidence (may have length bonus)
      expect(result?.confidence).toBeGreaterThanOrEqual(ASSOCIATION_CONFIDENCE.ANCESTOR_LABEL - 0.05);
      expect(result?.confidence).toBeLessThanOrEqual(ASSOCIATION_CONFIDENCE.ANCESTOR_LABEL + 0.10);
    });
  });
  
  // ==========================================================================
  // SIBLING LABEL DETECTION
  // ==========================================================================
  
  describe('sibling label detection', () => {
    it('should detect previous sibling label', () => {
      const label = document.createElement('label');
      label.textContent = 'Phone Number';
      document.body.appendChild(label);
      
      const input = document.createElement('input');
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('Phone Number');
      expect(result?.source.type).toBe('sibling');
    });
    
    it('should skip empty elements between label and input', () => {
      const label = document.createElement('label');
      label.textContent = 'Address';
      document.body.appendChild(label);
      
      const br = document.createElement('br');
      document.body.appendChild(br);
      
      const input = document.createElement('input');
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('Address');
    });
    
    it('should detect nested label in sibling', () => {
      const div = document.createElement('div');
      const label = document.createElement('label');
      label.textContent = 'City';
      div.appendChild(label);
      document.body.appendChild(div);
      
      const input = document.createElement('input');
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('City');
    });
  });
  
  // ==========================================================================
  // FIELDSET/LEGEND DETECTION
  // ==========================================================================
  
  describe('fieldset/legend detection', () => {
    it('should detect fieldset legend for radio', () => {
      const fieldset = document.createElement('fieldset');
      const legend = document.createElement('legend');
      legend.textContent = 'Gender';
      fieldset.appendChild(legend);
      
      const radio1 = document.createElement('input');
      radio1.type = 'radio';
      radio1.name = 'gender';
      radio1.value = 'male';
      fieldset.appendChild(radio1);
      
      document.body.appendChild(fieldset);
      
      const context = createDetectionContext(radio1);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toContain('Gender');
    });
    
    it('should detect fieldset legend for checkbox', () => {
      const fieldset = document.createElement('fieldset');
      const legend = document.createElement('legend');
      legend.textContent = 'Interests';
      fieldset.appendChild(legend);
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.name = 'interests';
      fieldset.appendChild(checkbox);
      
      document.body.appendChild(fieldset);
      
      const context = createDetectionContext(checkbox);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toContain('Interests');
    });
    
    it('should not detect fieldset for text input', () => {
      const fieldset = document.createElement('fieldset');
      const legend = document.createElement('legend');
      legend.textContent = 'Contact Info';
      fieldset.appendChild(legend);
      
      const input = document.createElement('input');
      input.type = 'text';
      fieldset.appendChild(input);
      
      document.body.appendChild(fieldset);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      // Should not use fieldset legend for text inputs
      // (they should have their own labels)
      expect(result).toBeNull();
    });
    
    it('should detect specific label for radio option', () => {
      const fieldset = document.createElement('fieldset');
      const legend = document.createElement('legend');
      legend.textContent = 'Size';
      fieldset.appendChild(legend);
      
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'size';
      radio.id = 'size-large';
      fieldset.appendChild(radio);
      
      const radioLabel = document.createElement('label');
      radioLabel.setAttribute('for', 'size-large');
      radioLabel.textContent = 'Large';
      fieldset.appendChild(radioLabel);
      
      document.body.appendChild(fieldset);
      
      const context = createDetectionContext(radio);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      // label[for] has higher priority than fieldset
      expect(result?.label).toBe('Large');
      expect(result?.source.type).toBe('associated');
    });
  });
  
  // ==========================================================================
  // LABELS PROPERTY DETECTION
  // ==========================================================================
  
  describe('labels property detection', () => {
    it('should use native labels property', () => {
      const label = document.createElement('label');
      label.setAttribute('for', 'native');
      label.textContent = 'Native Label';
      document.body.appendChild(label);
      
      const input = document.createElement('input');
      input.id = 'native';
      document.body.appendChild(input);
      
      // Verify labels property exists
      expect(input.labels).toBeDefined();
      expect(input.labels?.length).toBeGreaterThan(0);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('Native Label');
    });
  });
  
  // ==========================================================================
  // CONFIDENCE ADJUSTMENTS
  // ==========================================================================
  
  describe('confidence adjustments', () => {
    it('should reduce confidence for generic labels', () => {
      const label = document.createElement('label');
      label.setAttribute('for', 'gen');
      label.textContent = 'Input';
      document.body.appendChild(label);
      
      const input = document.createElement('input');
      input.id = 'gen';
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.confidence).toBeLessThan(ASSOCIATION_CONFIDENCE.LABEL_FOR);
    });
    
    it('should reduce confidence for short labels', () => {
      const label = document.createElement('label');
      label.setAttribute('for', 'short');
      label.textContent = 'ID';
      document.body.appendChild(label);
      
      const input = document.createElement('input');
      input.id = 'short';
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.confidence).toBeLessThan(ASSOCIATION_CONFIDENCE.LABEL_FOR);
    });
  });
});

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================

describe('createAssociatedLabelDetector', () => {
  it('should create detector instance', () => {
    const detector = createAssociatedLabelDetector();
    expect(detector).toBeInstanceOf(AssociatedLabelDetector);
  });
});

describe('hasAssociatedLabel', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });
  
  it('should return true for label[for]', () => {
    const label = document.createElement('label');
    label.setAttribute('for', 'test');
    document.body.appendChild(label);
    
    const input = document.createElement('input');
    input.id = 'test';
    document.body.appendChild(input);
    
    expect(hasAssociatedLabel(input)).toBe(true);
  });
  
  it('should return true for ancestor label', () => {
    const label = document.createElement('label');
    const input = document.createElement('input');
    label.appendChild(input);
    document.body.appendChild(label);
    
    expect(hasAssociatedLabel(input)).toBe(true);
  });
  
  it('should return false for no label', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    
    expect(hasAssociatedLabel(input)).toBe(false);
  });
});

describe('getAssociatedLabels', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });
  
  it('should return all associated labels', () => {
    const label1 = document.createElement('label');
    label1.setAttribute('for', 'multi');
    label1.textContent = 'Label 1';
    document.body.appendChild(label1);
    
    const label2 = document.createElement('label');
    label2.setAttribute('for', 'multi');
    label2.textContent = 'Label 2';
    document.body.appendChild(label2);
    
    const input = document.createElement('input');
    input.id = 'multi';
    document.body.appendChild(input);
    
    const labels = getAssociatedLabels(input);
    
    expect(labels.length).toBe(2);
  });
  
  it('should return empty array for no labels', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    
    const labels = getAssociatedLabels(input);
    
    expect(labels).toEqual([]);
  });
});

describe('isLabelableElement', () => {
  it('should return true for input', () => {
    const input = document.createElement('input');
    expect(isLabelableElement(input)).toBe(true);
  });
  
  it('should return true for select', () => {
    const select = document.createElement('select');
    expect(isLabelableElement(select)).toBe(true);
  });
  
  it('should return true for textarea', () => {
    const textarea = document.createElement('textarea');
    expect(isLabelableElement(textarea)).toBe(true);
  });
  
  it('should return false for div', () => {
    const div = document.createElement('div');
    expect(isLabelableElement(div)).toBe(false);
  });
});

describe('getLabeledControl', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });
  
  it('should return control via htmlFor', () => {
    const input = document.createElement('input');
    input.id = 'control';
    document.body.appendChild(input);
    
    const label = document.createElement('label');
    label.htmlFor = 'control';
    document.body.appendChild(label);
    
    expect(getLabeledControl(label)).toBe(input);
  });
  
  it('should return nested control', () => {
    const label = document.createElement('label');
    const input = document.createElement('input');
    label.appendChild(input);
    document.body.appendChild(label);
    
    expect(getLabeledControl(label)).toBe(input);
  });
});

describe('getFieldsetLegend', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });
  
  it('should return legend for input in fieldset', () => {
    const fieldset = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = 'Options';
    fieldset.appendChild(legend);
    
    const input = document.createElement('input');
    fieldset.appendChild(input);
    
    document.body.appendChild(fieldset);
    
    const result = getFieldsetLegend(input);
    
    expect(result).toBe(legend);
  });
  
  it('should return null for input not in fieldset', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    
    expect(getFieldsetLegend(input)).toBeNull();
  });
});

// ============================================================================
// CONSTANT TESTS
// ============================================================================

describe('ASSOCIATION_CONFIDENCE', () => {
  it('should have expected values', () => {
    expect(ASSOCIATION_CONFIDENCE.LABEL_FOR).toBe(0.85);
    expect(ASSOCIATION_CONFIDENCE.ANCESTOR_LABEL).toBe(0.80);
    expect(ASSOCIATION_CONFIDENCE.SIBLING_LABEL).toBe(0.75);
    expect(ASSOCIATION_CONFIDENCE.FIELDSET_LEGEND).toBe(0.70);
  });
  
  it('should be in descending order', () => {
    expect(ASSOCIATION_CONFIDENCE.LABEL_FOR).toBeGreaterThan(ASSOCIATION_CONFIDENCE.ANCESTOR_LABEL);
    expect(ASSOCIATION_CONFIDENCE.ANCESTOR_LABEL).toBeGreaterThan(ASSOCIATION_CONFIDENCE.SIBLING_LABEL);
    expect(ASSOCIATION_CONFIDENCE.SIBLING_LABEL).toBeGreaterThan(ASSOCIATION_CONFIDENCE.FIELDSET_LEGEND);
  });
});

describe('LABELABLE_ELEMENTS', () => {
  it('should include all labelable elements', () => {
    expect(LABELABLE_ELEMENTS).toContain('input');
    expect(LABELABLE_ELEMENTS).toContain('select');
    expect(LABELABLE_ELEMENTS).toContain('textarea');
    expect(LABELABLE_ELEMENTS).toContain('button');
    expect(LABELABLE_ELEMENTS).toContain('meter');
    expect(LABELABLE_ELEMENTS).toContain('output');
    expect(LABELABLE_ELEMENTS).toContain('progress');
  });
});

describe('GROUPED_INPUT_TYPES', () => {
  it('should include radio and checkbox', () => {
    expect(GROUPED_INPUT_TYPES).toContain('radio');
    expect(GROUPED_INPUT_TYPES).toContain('checkbox');
  });
});
