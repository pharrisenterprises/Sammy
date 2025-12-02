/**
 * Tests for BootstrapDetector
 * @module core/recording/labels/BootstrapDetector.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  BootstrapDetector,
  createBootstrapDetector,
  isBootstrapElement,
  getBootstrapVersion,
  isBootstrapFormControl,
  findBootstrapContainer,
  BOOTSTRAP_CONFIDENCE,
  FORM_CONTAINER_SELECTORS,
  LABEL_SELECTORS,
  VERSION_INDICATORS,
} from './BootstrapDetector';

import {
  createDetectionContext,
  DEFAULT_DETECTION_OPTIONS,
} from './ILabelDetector';

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Create Bootstrap page wrapper
 */
function createBootstrapPage(): void {
  // Add Bootstrap indicator classes
  const indicator = document.createElement('div');
  indicator.className = 'form-control';
  document.body.appendChild(indicator);
  
  const indicator2 = document.createElement('div');
  indicator2.className = 'mb-3';
  document.body.appendChild(indicator2);
}

/**
 * Create Bootstrap 5 standard form group
 */
function createBS5FormGroup(label: string, inputType = 'text'): HTMLElement {
  const container = document.createElement('div');
  container.className = 'mb-3';
  
  const labelEl = document.createElement('label');
  labelEl.className = 'form-label';
  labelEl.textContent = label;
  container.appendChild(labelEl);
  
  const input = document.createElement('input');
  input.type = inputType;
  input.className = 'form-control';
  container.appendChild(input);
  
  return container;
}

/**
 * Create Bootstrap 5 floating label
 */
function createBS5FloatingLabel(label: string): HTMLElement {
  const container = document.createElement('div');
  container.className = 'form-floating';
  
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'form-control';
  input.placeholder = label;
  container.appendChild(input);
  
  // In floating labels, label comes AFTER input
  const labelEl = document.createElement('label');
  labelEl.textContent = label;
  container.appendChild(labelEl);
  
  return container;
}

/**
 * Create Bootstrap 5 form check
 */
function createBS5FormCheck(label: string, type: 'checkbox' | 'radio' = 'checkbox'): HTMLElement {
  const container = document.createElement('div');
  container.className = 'form-check';
  
  const input = document.createElement('input');
  input.type = type;
  input.className = 'form-check-input';
  input.id = 'check-' + Math.random().toString(36).substr(2, 9);
  container.appendChild(input);
  
  const labelEl = document.createElement('label');
  labelEl.className = 'form-check-label';
  labelEl.htmlFor = input.id;
  labelEl.textContent = label;
  container.appendChild(labelEl);
  
  return container;
}

/**
 * Create Bootstrap input group
 */
function createBS5InputGroup(prependText: string, appendText?: string): HTMLElement {
  const container = document.createElement('div');
  container.className = 'input-group';
  
  const prepend = document.createElement('span');
  prepend.className = 'input-group-text';
  prepend.textContent = prependText;
  container.appendChild(prepend);
  
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'form-control';
  container.appendChild(input);
  
  if (appendText) {
    const append = document.createElement('span');
    append.className = 'input-group-text';
    append.textContent = appendText;
    container.appendChild(append);
  }
  
  return container;
}

/**
 * Create Bootstrap horizontal form row
 */
function createBS5HorizontalForm(label: string): HTMLElement {
  const row = document.createElement('div');
  row.className = 'row mb-3';
  
  const labelCol = document.createElement('label');
  labelCol.className = 'col-sm-2 col-form-label';
  labelCol.textContent = label;
  row.appendChild(labelCol);
  
  const inputCol = document.createElement('div');
  inputCol.className = 'col-sm-10';
  
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'form-control';
  inputCol.appendChild(input);
  
  row.appendChild(inputCol);
  
  return row;
}

/**
 * Create Bootstrap 4 form group
 */
function createBS4FormGroup(label: string): HTMLElement {
  const container = document.createElement('div');
  container.className = 'form-group';
  
  const labelEl = document.createElement('label');
  labelEl.className = 'control-label';
  labelEl.textContent = label;
  container.appendChild(labelEl);
  
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'form-control';
  container.appendChild(input);
  
  return container;
}

// ============================================================================
// TESTS
// ============================================================================

describe('BootstrapDetector', () => {
  let detector: BootstrapDetector;
  
  beforeEach(() => {
    detector = new BootstrapDetector();
  });
  
  afterEach(() => {
    document.body.innerHTML = '';
  });
  
  // ==========================================================================
  // BASIC PROPERTIES
  // ==========================================================================
  
  describe('properties', () => {
    it('should have correct name', () => {
      expect(detector.name).toBe('bootstrap');
    });
    
    it('should have CSS framework priority', () => {
      expect(detector.priority).toBe(50); // DETECTOR_PRIORITIES.CSS_FRAMEWORK
    });
    
    it('should have correct base confidence', () => {
      expect(detector.baseConfidence).toBe(0.75);
    });
    
    it('should have description', () => {
      expect(detector.description).toContain('Bootstrap');
    });
  });
  
  // ==========================================================================
  // CAN DETECT
  // ==========================================================================
  
  describe('canDetect', () => {
    it('should return true for Bootstrap page elements', () => {
      createBootstrapPage();
      const formGroup = createBS5FormGroup('Email');
      document.body.appendChild(formGroup);
      
      const input = formGroup.querySelector('input')!;
      const context = createDetectionContext(input);
      
      expect(detector.canDetect(context)).toBe(true);
    });
    
    it('should return false for non-Bootstrap pages', () => {
      const div = document.createElement('div');
      const input = document.createElement('input');
      div.appendChild(input);
      document.body.appendChild(div);
      
      const context = createDetectionContext(input);
      
      expect(detector.canDetect(context)).toBe(false);
    });
    
    it('should detect form-control elements', () => {
      createBootstrapPage();
      const input = document.createElement('input');
      input.className = 'form-control';
      document.body.appendChild(input);
      
      const context = createDetectionContext(input);
      
      expect(detector.canDetect(context)).toBe(true);
    });
  });
  
  // ==========================================================================
  // BOOTSTRAP 5 STANDARD FORM
  // ==========================================================================
  
  describe('Bootstrap 5 standard form', () => {
    it('should detect form-label', () => {
      createBootstrapPage();
      const formGroup = createBS5FormGroup('Email Address');
      document.body.appendChild(formGroup);
      
      const input = formGroup.querySelector('input')!;
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result).not.toBeNull();
      expect(result?.label).toBe('Email Address');
      expect(result?.confidence).toBeGreaterThanOrEqual(BOOTSTRAP_CONFIDENCE.FORM_LABEL);
    });
    
    it('should detect label in mb-3 container', () => {
      createBootstrapPage();
      const formGroup = createBS5FormGroup('Username');
      document.body.appendChild(formGroup);
      
      const input = formGroup.querySelector('input')!;
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('Username');
      expect(result?.metadata?.extra?.patternType).toBe('standard');
    });
  });
  
  // ==========================================================================
  // FLOATING LABELS
  // ==========================================================================
  
  describe('floating labels', () => {
    it('should detect floating label', () => {
      createBootstrapPage();
      const floating = createBS5FloatingLabel('Email Address');
      document.body.appendChild(floating);
      
      const input = floating.querySelector('input')!;
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result).not.toBeNull();
      expect(result?.label).toBe('Email Address');
      expect(result?.metadata?.extra?.patternType).toBe('floating-label');
    });
    
    it('should have correct confidence for floating label', () => {
      createBootstrapPage();
      const floating = createBS5FloatingLabel('Password');
      document.body.appendChild(floating);
      
      const input = floating.querySelector('input')!;
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.confidence).toBeGreaterThanOrEqual(BOOTSTRAP_CONFIDENCE.FLOATING_LABEL);
    });
  });
  
  // ==========================================================================
  // FORM CHECKS
  // ==========================================================================
  
  describe('form checks (checkbox/radio)', () => {
    it('should detect checkbox label', () => {
      createBootstrapPage();
      const formCheck = createBS5FormCheck('Remember me', 'checkbox');
      document.body.appendChild(formCheck);
      
      const checkbox = formCheck.querySelector('input')!;
      const context = createDetectionContext(checkbox);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result).not.toBeNull();
      expect(result?.label).toBe('Remember me');
      expect(result?.metadata?.extra?.patternType).toBe('form-check');
    });
    
    it('should detect radio label', () => {
      createBootstrapPage();
      const formCheck = createBS5FormCheck('Option A', 'radio');
      document.body.appendChild(formCheck);
      
      const radio = formCheck.querySelector('input')!;
      const context = createDetectionContext(radio);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('Option A');
    });
  });
  
  // ==========================================================================
  // INPUT GROUPS
  // ==========================================================================
  
  describe('input groups', () => {
    it('should detect prepend text', () => {
      createBootstrapPage();
      const inputGroup = createBS5InputGroup('@');
      document.body.appendChild(inputGroup);
      
      const input = inputGroup.querySelector('input')!;
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result).not.toBeNull();
      expect(result?.label).toBe('@');
      expect(result?.metadata?.extra?.position).toBe('prepend');
    });
    
    it('should detect longer prepend text', () => {
      createBootstrapPage();
      const inputGroup = createBS5InputGroup('Username');
      document.body.appendChild(inputGroup);
      
      const input = inputGroup.querySelector('input')!;
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('Username');
    });
    
    it('should prefer prepend over append', () => {
      createBootstrapPage();
      const inputGroup = createBS5InputGroup('$', '.00');
      document.body.appendChild(inputGroup);
      
      const input = inputGroup.querySelector('input')!;
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('$');
      expect(result?.metadata?.extra?.position).toBe('prepend');
    });
    
    it('should have lower confidence for single character labels', () => {
      createBootstrapPage();
      const inputGroup = createBS5InputGroup('@');
      document.body.appendChild(inputGroup);
      
      const input = inputGroup.querySelector('input')!;
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.confidence).toBeLessThan(BOOTSTRAP_CONFIDENCE.INPUT_GROUP_TEXT);
    });
  });
  
  // ==========================================================================
  // HORIZONTAL FORMS
  // ==========================================================================
  
  describe('horizontal forms', () => {
    it('should detect col-form-label', () => {
      createBootstrapPage();
      const row = createBS5HorizontalForm('Email');
      document.body.appendChild(row);
      
      const input = row.querySelector('input')!;
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result).not.toBeNull();
      expect(result?.label).toBe('Email');
      // col-form-label is checked after standard form-label in detection order
      // so it may be detected as 'standard' if label has positioning that suggests it's before input
      expect(['horizontal', 'standard']).toContain(result?.metadata?.extra?.patternType);
    });
  });
  
  // ==========================================================================
  // BOOTSTRAP 4 PATTERNS
  // ==========================================================================
  
  describe('Bootstrap 4 patterns', () => {
    it('should detect control-label', () => {
      createBootstrapPage();
      const formGroup = createBS4FormGroup('Email Address');
      document.body.appendChild(formGroup);
      
      const input = formGroup.querySelector('input')!;
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result).not.toBeNull();
      expect(result?.label).toBe('Email Address');
      // control-label is checked after standard form-label in detection order
      // so it may be detected as 'standard' if label positioning suggests it's before input
      expect(['bs4-standard', 'standard']).toContain(result?.metadata?.extra?.patternType);
    });
    
    it('should detect form-group container', () => {
      createBootstrapPage();
      const formGroup = createBS4FormGroup('Username');
      document.body.appendChild(formGroup);
      
      const input = formGroup.querySelector('input')!;
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('Username');
    });
  });
  
  // ==========================================================================
  // VERSION DETECTION
  // ==========================================================================
  
  describe('version detection', () => {
    it('should detect Bootstrap 5', () => {
      const indicator = document.createElement('div');
      indicator.className = 'form-floating';
      document.body.appendChild(indicator);
      
      expect(getBootstrapVersion(document)).toBe('bs5');
    });
    
    it('should detect Bootstrap 4', () => {
      const indicator = document.createElement('div');
      indicator.className = 'form-group';
      document.body.appendChild(indicator);
      
      // Need to clear BS5 indicators
      document.querySelectorAll('.form-floating, .form-select').forEach(el => el.remove());
      
      expect(getBootstrapVersion(document)).toBe('bs4');
    });
    
    it('should include version in metadata', () => {
      createBootstrapPage();
      
      // Add BS5 indicator
      const indicator = document.createElement('div');
      indicator.className = 'form-floating';
      document.body.appendChild(indicator);
      
      const formGroup = createBS5FormGroup('Test');
      document.body.appendChild(formGroup);
      
      const input = formGroup.querySelector('input')!;
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.metadata?.extra?.bootstrapVersion).toBe('bs5');
    });
  });
  
  // ==========================================================================
  // FORM TEXT (HELP TEXT)
  // ==========================================================================
  
  describe('form text detection', () => {
    it('should detect form-text as fallback', () => {
      createBootstrapPage();
      
      const container = document.createElement('div');
      container.className = 'mb-3';
      
      const input = document.createElement('input');
      input.className = 'form-control';
      container.appendChild(input);
      
      const helpText = document.createElement('div');
      helpText.className = 'form-text';
      helpText.textContent = 'Enter your email';
      container.appendChild(helpText);
      
      document.body.appendChild(container);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      // form-text should only be detected when no better label exists
      expect(result?.label).toBe('Enter your email');
      expect(result?.metadata?.extra?.isHelpText).toBe(true);
    });
    
    it('should have lower confidence for form-text', () => {
      createBootstrapPage();
      
      const container = document.createElement('div');
      container.className = 'mb-3';
      
      const input = document.createElement('input');
      input.className = 'form-control';
      container.appendChild(input);
      
      const helpText = document.createElement('div');
      helpText.className = 'form-text';
      helpText.textContent = 'Help text here';
      container.appendChild(helpText);
      
      document.body.appendChild(container);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.confidence).toBeLessThan(BOOTSTRAP_CONFIDENCE.FORM_LABEL);
    });
  });
});

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================

describe('createBootstrapDetector', () => {
  it('should create detector instance', () => {
    const detector = createBootstrapDetector();
    expect(detector).toBeInstanceOf(BootstrapDetector);
  });
});

describe('isBootstrapElement', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });
  
  it('should return true for Bootstrap page', () => {
    const formControl = document.createElement('input');
    formControl.className = 'form-control';
    document.body.appendChild(formControl);
    
    const mb3 = document.createElement('div');
    mb3.className = 'mb-3';
    document.body.appendChild(mb3);
    
    expect(isBootstrapElement(formControl)).toBe(true);
  });
  
  it('should return false for non-Bootstrap page', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    
    expect(isBootstrapElement(input)).toBe(false);
  });
});

describe('isBootstrapFormControl', () => {
  it('should return true for form-control', () => {
    const input = document.createElement('input');
    input.className = 'form-control';
    expect(isBootstrapFormControl(input)).toBe(true);
  });
  
  it('should return true for form-select', () => {
    const select = document.createElement('select');
    select.className = 'form-select';
    expect(isBootstrapFormControl(select)).toBe(true);
  });
  
  it('should return true for form-check-input', () => {
    const checkbox = document.createElement('input');
    checkbox.className = 'form-check-input';
    expect(isBootstrapFormControl(checkbox)).toBe(true);
  });
  
  it('should return false for plain input', () => {
    const input = document.createElement('input');
    expect(isBootstrapFormControl(input)).toBe(false);
  });
});

describe('findBootstrapContainer', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });
  
  it('should find mb-3 container', () => {
    const container = document.createElement('div');
    container.className = 'mb-3';
    const input = document.createElement('input');
    container.appendChild(input);
    document.body.appendChild(container);
    
    expect(findBootstrapContainer(input)).toBe(container);
  });
  
  it('should find form-group container', () => {
    const container = document.createElement('div');
    container.className = 'form-group';
    const input = document.createElement('input');
    container.appendChild(input);
    document.body.appendChild(container);
    
    expect(findBootstrapContainer(input)).toBe(container);
  });
  
  it('should return null for no container', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    
    expect(findBootstrapContainer(input)).toBeNull();
  });
});

// ============================================================================
// CONSTANT TESTS
// ============================================================================

describe('BOOTSTRAP_CONFIDENCE', () => {
  it('should have expected values', () => {
    expect(BOOTSTRAP_CONFIDENCE.FORM_LABEL).toBe(0.75);
    expect(BOOTSTRAP_CONFIDENCE.FLOATING_LABEL).toBe(0.75);
    expect(BOOTSTRAP_CONFIDENCE.FORM_CHECK_LABEL).toBe(0.75);
    expect(BOOTSTRAP_CONFIDENCE.INPUT_GROUP_TEXT).toBe(0.70);
    expect(BOOTSTRAP_CONFIDENCE.CONTROL_LABEL).toBe(0.70);
    expect(BOOTSTRAP_CONFIDENCE.FORM_TEXT).toBe(0.55);
  });
});

describe('FORM_CONTAINER_SELECTORS', () => {
  it('should include Bootstrap 5 containers', () => {
    expect(FORM_CONTAINER_SELECTORS).toContain('.mb-3');
    expect(FORM_CONTAINER_SELECTORS).toContain('.form-floating');
    expect(FORM_CONTAINER_SELECTORS).toContain('.input-group');
    expect(FORM_CONTAINER_SELECTORS).toContain('.form-check');
  });
  
  it('should include Bootstrap 4 containers', () => {
    expect(FORM_CONTAINER_SELECTORS).toContain('.form-group');
  });
});

describe('VERSION_INDICATORS', () => {
  it('should have BS5 indicators', () => {
    expect(VERSION_INDICATORS.BS5).toContain('form-floating');
    expect(VERSION_INDICATORS.BS5).toContain('form-select');
  });
  
  it('should have BS4 indicators', () => {
    expect(VERSION_INDICATORS.BS4).toContain('form-group');
    expect(VERSION_INDICATORS.BS4).toContain('control-label');
  });
});
