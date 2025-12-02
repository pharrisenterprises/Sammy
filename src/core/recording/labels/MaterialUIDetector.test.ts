/**
 * Tests for MaterialUIDetector
 * @module core/recording/labels/MaterialUIDetector.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  MaterialUIDetector,
  createMaterialUIDetector,
  isMUIElement,
  getMUIVersion,
  isMUIFormControl,
  findMUIFormControl,
  getMUITextFieldVariant,
  MUI_CONFIDENCE,
  FORM_CONTROL_SELECTORS,
  LABEL_SELECTORS,
  INPUT_SELECTORS,
} from './MaterialUIDetector';

import {
  createDetectionContext,
  DEFAULT_DETECTION_OPTIONS,
} from './ILabelDetector';

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Create MUI page indicator
 */
function createMUIPage(): void {
  const indicator = document.createElement('div');
  indicator.className = 'MuiBox-root';
  document.body.appendChild(indicator);
}

/**
 * Create MUI TextField (outlined variant)
 */
function createMUITextField(label: string, options: {
  variant?: 'outlined' | 'filled' | 'standard';
  required?: boolean;
  placeholder?: string;
  helperText?: string;
} = {}): HTMLElement {
  const { variant = 'outlined', required = false, placeholder, helperText } = options;
  
  const formControl = document.createElement('div');
  formControl.className = `MuiFormControl-root MuiTextField-root`;
  
  // Input label
  const inputLabel = document.createElement('label');
  inputLabel.className = 'MuiInputLabel-root MuiInputLabel-formControl';
  inputLabel.setAttribute('data-shrink', 'false');
  inputLabel.textContent = label;
  
  if (required) {
    const asterisk = document.createElement('span');
    asterisk.className = 'MuiInputLabel-asterisk';
    asterisk.textContent = ' *';
    inputLabel.appendChild(asterisk);
  }
  
  formControl.appendChild(inputLabel);
  
  // Input base
  const inputBase = document.createElement('div');
  inputBase.className = `MuiInputBase-root Mui${variant.charAt(0).toUpperCase() + variant.slice(1)}Input-root`;
  
  const input = document.createElement('input');
  input.className = `MuiInputBase-input Mui${variant.charAt(0).toUpperCase() + variant.slice(1)}Input-input`;
  input.type = 'text';
  
  if (placeholder) {
    input.placeholder = placeholder;
  }
  
  inputBase.appendChild(input);
  formControl.appendChild(inputBase);
  
  // Helper text
  if (helperText) {
    const helper = document.createElement('p');
    helper.className = 'MuiFormHelperText-root';
    helper.textContent = helperText;
    formControl.appendChild(helper);
  }
  
  return formControl;
}

/**
 * Create MUI FormControlLabel (checkbox/radio)
 */
function createMUIFormControlLabel(label: string, type: 'checkbox' | 'radio' | 'switch' = 'checkbox'): HTMLElement {
  const formControlLabel = document.createElement('label');
  formControlLabel.className = 'MuiFormControlLabel-root';
  
  // Toggle component
  const toggle = document.createElement('span');
  toggle.className = `Mui${type.charAt(0).toUpperCase() + type.slice(1)}-root`;
  
  const input = document.createElement('input');
  input.type = type === 'switch' ? 'checkbox' : type;
  input.className = 'MuiSwitch-input MuiPrivateSwitchBase-input';
  toggle.appendChild(input);
  
  formControlLabel.appendChild(toggle);
  
  // Label text
  const typography = document.createElement('span');
  typography.className = 'MuiTypography-root MuiFormControlLabel-label';
  typography.textContent = label;
  formControlLabel.appendChild(typography);
  
  return formControlLabel;
}

/**
 * Create MUI Select
 */
function createMUISelect(label: string): HTMLElement {
  const formControl = document.createElement('div');
  formControl.className = 'MuiFormControl-root';
  
  // Input label
  const inputLabel = document.createElement('label');
  inputLabel.className = 'MuiInputLabel-root';
  inputLabel.textContent = label;
  formControl.appendChild(inputLabel);
  
  // Select
  const selectRoot = document.createElement('div');
  selectRoot.className = 'MuiInputBase-root MuiOutlinedInput-root';
  
  const select = document.createElement('div');
  select.className = 'MuiSelect-select MuiSelect-outlined';
  select.setAttribute('role', 'button');
  selectRoot.appendChild(select);
  
  formControl.appendChild(selectRoot);
  
  return formControl;
}

/**
 * Create MUI Autocomplete
 */
function createMUIAutocomplete(label: string): HTMLElement {
  const autocomplete = document.createElement('div');
  autocomplete.className = 'MuiAutocomplete-root';
  
  const formControl = document.createElement('div');
  formControl.className = 'MuiFormControl-root MuiTextField-root';
  
  const inputLabel = document.createElement('label');
  inputLabel.className = 'MuiInputLabel-root';
  inputLabel.textContent = label;
  formControl.appendChild(inputLabel);
  
  const inputBase = document.createElement('div');
  inputBase.className = 'MuiInputBase-root MuiOutlinedInput-root MuiAutocomplete-inputRoot';
  
  const input = document.createElement('input');
  input.className = 'MuiInputBase-input MuiAutocomplete-input';
  input.type = 'text';
  inputBase.appendChild(input);
  
  formControl.appendChild(inputBase);
  autocomplete.appendChild(formControl);
  
  return autocomplete;
}

// ============================================================================
// TESTS
// ============================================================================

describe('MaterialUIDetector', () => {
  let detector: MaterialUIDetector;
  
  beforeEach(() => {
    detector = new MaterialUIDetector();
  });
  
  afterEach(() => {
    document.body.innerHTML = '';
  });
  
  // ==========================================================================
  // BASIC PROPERTIES
  // ==========================================================================
  
  describe('properties', () => {
    it('should have correct name', () => {
      expect(detector.name).toBe('material-ui');
    });
    
    it('should have CSS framework priority', () => {
      expect(detector.priority).toBe(50); // DETECTOR_PRIORITIES.CSS_FRAMEWORK
    });
    
    it('should have correct base confidence', () => {
      expect(detector.baseConfidence).toBe(0.70);
    });
    
    it('should have description', () => {
      expect(detector.description).toContain('Material-UI');
    });
  });
  
  // ==========================================================================
  // CAN DETECT
  // ==========================================================================
  
  describe('canDetect', () => {
    it('should return true for MUI page elements', () => {
      createMUIPage();
      const textField = createMUITextField('Email');
      document.body.appendChild(textField);
      
      const input = textField.querySelector('input')!;
      const context = createDetectionContext(input);
      
      expect(detector.canDetect(context)).toBe(true);
    });
    
    it('should return false for non-MUI pages', () => {
      const div = document.createElement('div');
      const input = document.createElement('input');
      div.appendChild(input);
      document.body.appendChild(div);
      
      const context = createDetectionContext(input);
      
      expect(detector.canDetect(context)).toBe(false);
    });
    
    it('should detect emotion styles (v5)', () => {
      const emotionStyle = document.createElement('style');
      emotionStyle.setAttribute('data-emotion', 'css');
      document.head.appendChild(emotionStyle);
      
      const textField = createMUITextField('Test');
      document.body.appendChild(textField);
      
      const input = textField.querySelector('input')!;
      const context = createDetectionContext(input);
      
      expect(detector.canDetect(context)).toBe(true);
      
      emotionStyle.remove();
    });
  });
  
  // ==========================================================================
  // TEXT FIELD DETECTION
  // ==========================================================================
  
  describe('TextField detection', () => {
    it('should detect InputLabel', () => {
      createMUIPage();
      const textField = createMUITextField('Email Address');
      document.body.appendChild(textField);
      
      const input = textField.querySelector('input')!;
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result).not.toBeNull();
      expect(result?.label).toBe('Email Address');
      expect(result?.confidence).toBeGreaterThanOrEqual(MUI_CONFIDENCE.INPUT_LABEL);
    });
    
    it('should exclude required asterisk from label', () => {
      createMUIPage();
      const textField = createMUITextField('Username', { required: true });
      document.body.appendChild(textField);
      
      const input = textField.querySelector('input')!;
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('Username');
      expect(result?.label).not.toContain('*');
    });
    
    it('should detect variant in metadata', () => {
      createMUIPage();
      const textField = createMUITextField('Name', { variant: 'outlined' });
      document.body.appendChild(textField);
      
      const input = textField.querySelector('input')!;
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.metadata?.extra?.variant).toBe('outlined');
    });
    
    it('should detect shrunk state', () => {
      createMUIPage();
      const textField = createMUITextField('Phone');
      const inputLabel = textField.querySelector('.MuiInputLabel-root')!;
      inputLabel.setAttribute('data-shrink', 'true');
      inputLabel.classList.add('MuiInputLabel-shrink');
      document.body.appendChild(textField);
      
      const input = textField.querySelector('input')!;
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.metadata?.extra?.isShrunk).toBe(true);
    });
  });
  
  // ==========================================================================
  // FORM CONTROL LABEL DETECTION
  // ==========================================================================
  
  describe('FormControlLabel detection', () => {
    it('should detect checkbox label', () => {
      createMUIPage();
      const formControlLabel = createMUIFormControlLabel('Remember me', 'checkbox');
      document.body.appendChild(formControlLabel);
      
      const checkbox = formControlLabel.querySelector('input')!;
      const context = createDetectionContext(checkbox);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result).not.toBeNull();
      expect(result?.label).toBe('Remember me');
      expect(result?.confidence).toBeGreaterThanOrEqual(MUI_CONFIDENCE.FORM_CONTROL_LABEL);
    });
    
    it('should detect radio label', () => {
      createMUIPage();
      const formControlLabel = createMUIFormControlLabel('Option A', 'radio');
      document.body.appendChild(formControlLabel);
      
      const radio = formControlLabel.querySelector('input')!;
      const context = createDetectionContext(radio);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('Option A');
      expect(result?.metadata?.extra?.componentType).toBe('radio');
    });
    
    it('should detect switch label', () => {
      createMUIPage();
      const formControlLabel = createMUIFormControlLabel('Enable notifications', 'switch');
      document.body.appendChild(formControlLabel);
      
      const switchInput = formControlLabel.querySelector('input')!;
      const context = createDetectionContext(switchInput);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('Enable notifications');
      expect(result?.metadata?.extra?.componentType).toBe('switch');
    });
  });
  
  // ==========================================================================
  // SELECT DETECTION
  // ==========================================================================
  
  describe('Select detection', () => {
    it('should detect Select label', () => {
      createMUIPage();
      const select = createMUISelect('Country');
      document.body.appendChild(select);
      
      const selectElement = select.querySelector('.MuiSelect-select')!;
      const context = createDetectionContext(selectElement);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result).not.toBeNull();
      expect(result?.label).toBe('Country');
    });
  });
  
  // ==========================================================================
  // AUTOCOMPLETE DETECTION
  // ==========================================================================
  
  describe('Autocomplete detection', () => {
    it('should detect Autocomplete label', () => {
      createMUIPage();
      const autocomplete = createMUIAutocomplete('Search Country');
      document.body.appendChild(autocomplete);
      
      const input = autocomplete.querySelector('.MuiAutocomplete-input')!;
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result).not.toBeNull();
      expect(result?.label).toBe('Search Country');
      // Can be either 'autocomplete' or 'input-label' depending on detection order
      expect(['autocomplete', 'input-label']).toContain(result?.metadata?.extra?.patternType);
    });
  });
  
  // ==========================================================================
  // PLACEHOLDER DETECTION
  // ==========================================================================
  
  describe('placeholder detection', () => {
    it('should detect placeholder when no InputLabel', () => {
      createMUIPage();
      
      const formControl = document.createElement('div');
      formControl.className = 'MuiFormControl-root';
      
      const inputBase = document.createElement('div');
      inputBase.className = 'MuiInputBase-root';
      
      const input = document.createElement('input');
      input.className = 'MuiInputBase-input';
      input.placeholder = 'Enter email';
      inputBase.appendChild(input);
      
      formControl.appendChild(inputBase);
      document.body.appendChild(formControl);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('Enter email');
      expect(result?.metadata?.extra?.patternType).toBe('placeholder');
    });
    
    it('should prefer InputLabel over placeholder', () => {
      createMUIPage();
      const textField = createMUITextField('Email', { placeholder: 'Enter email' });
      document.body.appendChild(textField);
      
      const input = textField.querySelector('input')!;
      input.placeholder = 'Enter email';
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('Email');
      expect(result?.metadata?.extra?.patternType).toBe('input-label');
    });
  });
  
  // ==========================================================================
  // HELPER TEXT DETECTION
  // ==========================================================================
  
  describe('helper text detection', () => {
    it('should detect helper text as fallback', () => {
      createMUIPage();
      
      const formControl = document.createElement('div');
      formControl.className = 'MuiFormControl-root';
      
      const inputBase = document.createElement('div');
      inputBase.className = 'MuiInputBase-root';
      
      const input = document.createElement('input');
      input.className = 'MuiInputBase-input';
      inputBase.appendChild(input);
      
      formControl.appendChild(inputBase);
      
      const helperText = document.createElement('p');
      helperText.className = 'MuiFormHelperText-root';
      helperText.textContent = 'Enter your email address';
      formControl.appendChild(helperText);
      
      document.body.appendChild(formControl);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('Enter your email address');
      expect(result?.metadata?.extra?.isHelperText).toBe(true);
    });
    
    it('should have lower confidence for helper text', () => {
      createMUIPage();
      const textField = createMUITextField('', { helperText: 'Helper text here' });
      // Remove the InputLabel to force fallback
      textField.querySelector('.MuiInputLabel-root')?.remove();
      document.body.appendChild(textField);
      
      const input = textField.querySelector('input')!;
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.confidence).toBeLessThan(MUI_CONFIDENCE.INPUT_LABEL);
    });
  });
  
  // ==========================================================================
  // VERSION DETECTION
  // ==========================================================================
  
  describe('version detection', () => {
    it('should detect MUI v5 (emotion)', () => {
      const emotionStyle = document.createElement('style');
      emotionStyle.setAttribute('data-emotion', 'css');
      document.head.appendChild(emotionStyle);
      
      expect(getMUIVersion(document)).toBe('v5');
      
      emotionStyle.remove();
    });
    
    it('should detect MUI v4 (JSS)', () => {
      const jssStyle = document.createElement('style');
      jssStyle.setAttribute('data-jss', '');
      document.head.appendChild(jssStyle);
      
      expect(getMUIVersion(document)).toBe('v4');
      
      jssStyle.remove();
    });
    
    it('should include version in metadata', () => {
      createMUIPage();
      const emotionStyle = document.createElement('style');
      emotionStyle.setAttribute('data-emotion', 'css');
      document.head.appendChild(emotionStyle);
      
      const textField = createMUITextField('Test');
      document.body.appendChild(textField);
      
      const input = textField.querySelector('input')!;
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.metadata?.extra?.muiVersion).toBe('v5');
      
      emotionStyle.remove();
    });
  });
});

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================

describe('createMaterialUIDetector', () => {
  it('should create detector instance', () => {
    const detector = createMaterialUIDetector();
    expect(detector).toBeInstanceOf(MaterialUIDetector);
  });
});

describe('isMUIElement', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });
  
  it('should return true for MUI page', () => {
    const muiElement = document.createElement('div');
    muiElement.className = 'MuiBox-root';
    document.body.appendChild(muiElement);
    
    expect(isMUIElement(muiElement)).toBe(true);
  });
  
  it('should return false for non-MUI page', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    
    expect(isMUIElement(div)).toBe(false);
  });
});

describe('isMUIFormControl', () => {
  it('should return true for MuiInputBase', () => {
    const input = document.createElement('input');
    input.className = 'MuiInputBase-input';
    expect(isMUIFormControl(input)).toBe(true);
  });
  
  it('should return true for MuiSelect', () => {
    const select = document.createElement('div');
    select.className = 'MuiSelect-select';
    expect(isMUIFormControl(select)).toBe(true);
  });
  
  it('should return false for plain input', () => {
    const input = document.createElement('input');
    expect(isMUIFormControl(input)).toBe(false);
  });
});

describe('findMUIFormControl', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });
  
  it('should find MuiFormControl-root', () => {
    const formControl = document.createElement('div');
    formControl.className = 'MuiFormControl-root';
    const input = document.createElement('input');
    formControl.appendChild(input);
    document.body.appendChild(formControl);
    
    expect(findMUIFormControl(input)).toBe(formControl);
  });
  
  it('should return null for no container', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    
    expect(findMUIFormControl(input)).toBeNull();
  });
});

describe('getMUITextFieldVariant', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });
  
  it('should detect outlined variant', () => {
    const formControl = document.createElement('div');
    formControl.className = 'MuiFormControl-root';
    
    const inputRoot = document.createElement('div');
    inputRoot.className = 'MuiOutlinedInput-root';
    formControl.appendChild(inputRoot);
    
    const input = document.createElement('input');
    inputRoot.appendChild(input);
    document.body.appendChild(formControl);
    
    expect(getMUITextFieldVariant(input)).toBe('outlined');
  });
  
  it('should detect filled variant', () => {
    const formControl = document.createElement('div');
    formControl.className = 'MuiFormControl-root';
    
    const inputRoot = document.createElement('div');
    inputRoot.className = 'MuiFilledInput-root';
    formControl.appendChild(inputRoot);
    
    const input = document.createElement('input');
    inputRoot.appendChild(input);
    document.body.appendChild(formControl);
    
    expect(getMUITextFieldVariant(input)).toBe('filled');
  });
  
  it('should default to standard', () => {
    const formControl = document.createElement('div');
    formControl.className = 'MuiFormControl-root';
    
    const input = document.createElement('input');
    formControl.appendChild(input);
    document.body.appendChild(formControl);
    
    expect(getMUITextFieldVariant(input)).toBe('standard');
  });
});

// ============================================================================
// CONSTANT TESTS
// ============================================================================

describe('MUI_CONFIDENCE', () => {
  it('should have expected values', () => {
    expect(MUI_CONFIDENCE.FORM_CONTROL_LABEL).toBe(0.75);
    expect(MUI_CONFIDENCE.INPUT_LABEL).toBe(0.70);
    expect(MUI_CONFIDENCE.FORM_LABEL).toBe(0.70);
    expect(MUI_CONFIDENCE.AUTOCOMPLETE).toBe(0.70);
    expect(MUI_CONFIDENCE.PLACEHOLDER).toBe(0.65);
    expect(MUI_CONFIDENCE.HELPER_TEXT).toBe(0.55);
  });
  
  it('should have FormControlLabel highest', () => {
    expect(MUI_CONFIDENCE.FORM_CONTROL_LABEL).toBeGreaterThan(MUI_CONFIDENCE.INPUT_LABEL);
  });
});

describe('FORM_CONTROL_SELECTORS', () => {
  it('should include main selectors', () => {
    expect(FORM_CONTROL_SELECTORS).toContain('.MuiFormControl-root');
    expect(FORM_CONTROL_SELECTORS).toContain('.MuiTextField-root');
  });
});

describe('LABEL_SELECTORS', () => {
  it('should have all label types', () => {
    expect(LABEL_SELECTORS.INPUT_LABEL).toBeDefined();
    expect(LABEL_SELECTORS.FORM_LABEL).toBeDefined();
    expect(LABEL_SELECTORS.FORM_CONTROL_LABEL).toBeDefined();
    expect(LABEL_SELECTORS.HELPER_TEXT).toBeDefined();
  });
});
