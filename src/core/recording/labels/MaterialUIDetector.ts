/**
 * MaterialUIDetector - Material-UI Component Label Detection
 * @module core/recording/labels/MaterialUIDetector
 * @version 1.0.0
 * 
 * Detects labels from Material-UI (MUI) component patterns.
 * Supports both MUI v4 (JSS classes) and MUI v5 (emotion classes).
 * 
 * ## Confidence Scores
 * - MuiFormControlLabel: 0.75 (checkbox/radio labels)
 * - MuiInputLabel: 0.70 (floating labels)
 * - MuiFormLabel: 0.70 (form labels)
 * - MuiFormHelperText: 0.55 (helper text fallback)
 * 
 * ## Supported Components
 * - TextField (standard, filled, outlined variants)
 * - Select
 * - Checkbox with FormControlLabel
 * - Radio with FormControlLabel
 * - Switch with FormControlLabel
 * - Autocomplete
 * 
 * @see https://mui.com/material-ui/react-text-field/
 * @see ILabelDetector for interface contract
 */

import {
  BaseLabelDetector,
  type LabelDetectionContext,
  type LabelDetectionOptions,
  type LabelDetectionResult,
  DETECTOR_PRIORITIES,
  CONFIDENCE_SCORES,
  cleanLabelText,
  getVisibleText,
} from './ILabelDetector';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Confidence scores for MUI patterns
 */
export const MUI_CONFIDENCE = {
  /** FormControlLabel (checkbox/radio/switch) */
  FORM_CONTROL_LABEL: 0.75,
  
  /** InputLabel (floating label) */
  INPUT_LABEL: 0.70,
  
  /** FormLabel */
  FORM_LABEL: 0.70,
  
  /** Autocomplete input */
  AUTOCOMPLETE: 0.70,
  
  /** Placeholder text */
  PLACEHOLDER: 0.65,
  
  /** Helper text (fallback) */
  HELPER_TEXT: 0.55,
} as const;

/**
 * MUI component class prefixes
 */
export const MUI_CLASS_PREFIXES = [
  'Mui',
  'MuiPrivate',
  'css-',  // Emotion (MUI v5)
  'jss',   // JSS (MUI v4)
] as const;

/**
 * MUI form control container selectors
 */
export const FORM_CONTROL_SELECTORS = [
  '.MuiFormControl-root',
  '.MuiTextField-root',
  '[class*="MuiFormControl"]',
  '[class*="MuiTextField"]',
] as const;

/**
 * MUI label selectors
 */
export const LABEL_SELECTORS = {
  /** Input label (floating) */
  INPUT_LABEL: [
    '.MuiInputLabel-root',
    '.MuiInputLabel-formControl',
    '[class*="MuiInputLabel"]',
  ],
  
  /** Form label */
  FORM_LABEL: [
    '.MuiFormLabel-root',
    '[class*="MuiFormLabel"]',
  ],
  
  /** Form control label (checkbox/radio wrapper) */
  FORM_CONTROL_LABEL: [
    '.MuiFormControlLabel-root',
    '[class*="MuiFormControlLabel"]',
  ],
  
  /** Typography within FormControlLabel */
  LABEL_TYPOGRAPHY: [
    '.MuiFormControlLabel-label',
    '.MuiTypography-root',
    '[class*="MuiFormControlLabel-label"]',
  ],
  
  /** Helper text */
  HELPER_TEXT: [
    '.MuiFormHelperText-root',
    '[class*="MuiFormHelperText"]',
  ],
} as const;

/**
 * MUI input selectors
 */
export const INPUT_SELECTORS = [
  '.MuiInputBase-input',
  '.MuiOutlinedInput-input',
  '.MuiFilledInput-input',
  '.MuiInput-input',
  '.MuiSelect-select',
  '.MuiAutocomplete-input',
  '[class*="MuiInputBase-input"]',
] as const;

/**
 * MUI checkbox/radio/switch selectors
 */
export const TOGGLE_SELECTORS = [
  '.MuiCheckbox-root',
  '.MuiRadio-root',
  '.MuiSwitch-root',
  '[class*="MuiCheckbox"]',
  '[class*="MuiRadio"]',
  '[class*="MuiSwitch"]',
] as const;

/**
 * MUI variant indicators
 */
export const VARIANT_INDICATORS = {
  OUTLINED: ['MuiOutlinedInput', 'Mui-outlined'],
  FILLED: ['MuiFilledInput', 'Mui-filled'],
  STANDARD: ['MuiInput-root', 'MuiInput-underline'],
} as const;

// ============================================================================
// MATERIAL-UI DETECTOR CLASS
// ============================================================================

/**
 * Detects labels from Material-UI component patterns
 * 
 * @example
 * ```typescript
 * const detector = new MaterialUIDetector();
 * 
 * // MUI TextField
 * // <div class="MuiFormControl-root">
 * //   <label class="MuiInputLabel-root">Email</label>
 * //   <div class="MuiInputBase-root">
 * //     <input class="MuiInputBase-input">
 * //   </div>
 * // </div>
 * const input = document.querySelector('.MuiInputBase-input');
 * 
 * const context = createDetectionContext(input);
 * const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
 * // result.label === 'Email'
 * // result.confidence === 0.70
 * ```
 */
export class MaterialUIDetector extends BaseLabelDetector {
  constructor() {
    super(
      'material-ui',
      DETECTOR_PRIORITIES.CSS_FRAMEWORK,
      CONFIDENCE_SCORES.MATERIAL_UI,
      'Detects labels from Material-UI (MUI) component patterns'
    );
  }
  
  /**
   * Check if page uses MUI and element is within MUI component
   */
  canDetect(context: LabelDetectionContext): boolean {
    const { element, document: doc } = context;
    
    // Quick check: is MUI present on page?
    if (!this.isMUIPage(doc)) {
      return false;
    }
    
    // Check if element is within an MUI component
    return this.isWithinMUIComponent(element);
  }
  
  /**
   * Detect label from MUI patterns
   */
  protected doDetect(
    context: LabelDetectionContext,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    const { element } = context;
    
    // Detect MUI version for metadata
    const version = this.detectMUIVersion(element.ownerDocument);
    
    // Try FormControlLabel first (checkbox/radio/switch)
    const formControlLabelResult = this.detectFormControlLabel(element, options);
    if (formControlLabelResult) {
      return this.addMUIMetadata(formControlLabelResult, version);
    }
    
    // Try Autocomplete label before InputLabel (Autocomplete wraps TextField)
    const autocompleteResult = this.detectAutocompleteLabel(element, options);
    if (autocompleteResult) {
      return this.addMUIMetadata(autocompleteResult, version);
    }
    
    // Try InputLabel (floating label)
    const inputLabelResult = this.detectInputLabel(element, options);
    if (inputLabelResult) {
      return this.addMUIMetadata(inputLabelResult, version);
    }
    
    // Try FormLabel
    const formLabelResult = this.detectFormLabel(element, options);
    if (formLabelResult) {
      return this.addMUIMetadata(formLabelResult, version);
    }
    
    // Try placeholder
    const placeholderResult = this.detectPlaceholder(element, options);
    if (placeholderResult) {
      return this.addMUIMetadata(placeholderResult, version);
    }
    
    // Try helper text as fallback
    const helperTextResult = this.detectHelperText(element, options);
    if (helperTextResult) {
      return this.addMUIMetadata(helperTextResult, version);
    }
    
    return null;
  }
  
  // ==========================================================================
  // PAGE DETECTION
  // ==========================================================================
  
  /**
   * Check if page uses Material-UI
   */
  private isMUIPage(doc: Document): boolean {
    // Check for MUI classes
    const hasMuiClasses = doc.querySelector('[class*="Mui"]') !== null;
    if (hasMuiClasses) {
      return true;
    }
    
    // Check for MUI CSS-in-JS styles
    const hasJSSStyles = doc.querySelector('[data-jss]') !== null;
    if (hasJSSStyles) {
      return true;
    }
    
    // Check for emotion styles (MUI v5)
    const hasEmotionStyles = doc.querySelector('[data-emotion]') !== null;
    if (hasEmotionStyles) {
      return true;
    }
    
    // Check for MUI data attributes
    const hasMuiDataAttrs = doc.querySelector('[data-mui-test]') !== null;
    if (hasMuiDataAttrs) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Check if element is within an MUI component
   */
  private isWithinMUIComponent(element: Element): boolean {
    // Check element's own classes
    const className = element.className || '';
    if (typeof className === 'string') {
      for (const prefix of MUI_CLASS_PREFIXES) {
        if (className.includes(prefix)) {
          return true;
        }
      }
    }
    
    // Check for MUI form control container
    for (const selector of FORM_CONTROL_SELECTORS) {
      if (element.closest(selector)) {
        return true;
      }
    }
    
    // Check for FormControlLabel wrapper
    for (const selector of LABEL_SELECTORS.FORM_CONTROL_LABEL) {
      if (element.closest(selector)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Detect MUI version
   */
  private detectMUIVersion(doc: Document): 'v5' | 'v4' | 'unknown' {
    // MUI v5 uses emotion
    if (doc.querySelector('[data-emotion]')) {
      return 'v5';
    }
    
    // MUI v4 uses JSS
    if (doc.querySelector('[data-jss]')) {
      return 'v4';
    }
    
    // Check class naming patterns
    // v5 often has css-* prefixed classes from emotion
    if (doc.querySelector('[class*="css-"]')) {
      return 'v5';
    }
    
    // v4 often has jss* prefixed classes
    if (doc.querySelector('[class*="jss"]')) {
      return 'v4';
    }
    
    return 'unknown';
  }
  
  /**
   * Add MUI metadata to result
   */
  private addMUIMetadata(
    result: LabelDetectionResult,
    version: 'v5' | 'v4' | 'unknown'
  ): LabelDetectionResult {
    return {
      ...result,
      metadata: {
        ...result.metadata,
        extra: {
          ...result.metadata?.extra,
          muiVersion: version,
        },
      },
    };
  }
  
  // ==========================================================================
  // FORM CONTROL LABEL DETECTION
  // ==========================================================================
  
  /**
   * Detect FormControlLabel (checkbox/radio/switch labels)
   * 
   * Pattern: <label class="MuiFormControlLabel-root">
   *            <span class="MuiCheckbox-root">...</span>
   *            <span class="MuiTypography-root">Label Text</span>
   *          </label>
   */
  private detectFormControlLabel(
    element: Element,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    // Find FormControlLabel wrapper
    let formControlLabel: Element | null = null;
    
    for (const selector of LABEL_SELECTORS.FORM_CONTROL_LABEL) {
      formControlLabel = element.closest(selector);
      if (formControlLabel) break;
    }
    
    if (!formControlLabel) {
      return null;
    }
    
    // Find the label text (Typography component)
    for (const selector of LABEL_SELECTORS.LABEL_TYPOGRAPHY) {
      const labelElement = formControlLabel.querySelector(selector);
      if (labelElement) {
        const labelText = getVisibleText(labelElement);
        if (labelText) {
          const cleanedLabel = cleanLabelText(labelText);
          if (cleanedLabel) {
            const confidence = this.adjustConfidence(
              MUI_CONFIDENCE.FORM_CONTROL_LABEL,
              cleanedLabel,
              {
                lengthBonus: true,
                genericPenalty: true,
              }
            );
            
            return this.createResult(cleanedLabel, labelElement, 'framework', {
              confidence,
              selector,
              xpath: this.getXPath(labelElement),
              metadata: {
                framework: 'material-ui',
                patternType: 'form-control-label',
                componentType: this.detectToggleType(element),
              },
            });
          }
        }
      }
    }
    
    return null;
  }
  
  /**
   * Detect toggle component type (checkbox/radio/switch)
   */
  private detectToggleType(element: Element): string {
    const parent = element.closest('[class*="MuiFormControlLabel"]');
    if (!parent) {
      return 'unknown';
    }
    
    if (parent.querySelector('[class*="MuiCheckbox"]')) {
      return 'checkbox';
    }
    if (parent.querySelector('[class*="MuiRadio"]')) {
      return 'radio';
    }
    if (parent.querySelector('[class*="MuiSwitch"]')) {
      return 'switch';
    }
    
    // Check input type
    const input = element instanceof HTMLInputElement ? element : element.querySelector('input');
    if (input) {
      return input.type || 'unknown';
    }
    
    return 'unknown';
  }
  
  // ==========================================================================
  // INPUT LABEL DETECTION
  // ==========================================================================
  
  /**
   * Detect InputLabel (floating label in TextField)
   * 
   * Pattern: <div class="MuiFormControl-root">
   *            <label class="MuiInputLabel-root" data-shrink="false">Email</label>
   *            <div class="MuiInputBase-root">
   *              <input>
   *            </div>
   *          </div>
   */
  private detectInputLabel(
    element: Element,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    // Find form control container
    let formControl: Element | null = null;
    
    for (const selector of FORM_CONTROL_SELECTORS) {
      formControl = element.closest(selector);
      if (formControl) break;
    }
    
    if (!formControl) {
      return null;
    }
    
    // Find InputLabel
    for (const selector of LABEL_SELECTORS.INPUT_LABEL) {
      const labelElement = formControl.querySelector(selector);
      if (labelElement) {
        const labelText = this.extractInputLabelText(labelElement);
        if (labelText) {
          const cleanedLabel = cleanLabelText(labelText);
          if (cleanedLabel) {
            // Check if label is shrunk (input has value)
            const isShrunk = labelElement.getAttribute('data-shrink') === 'true' ||
                            labelElement.classList.contains('MuiInputLabel-shrink');
            
            // Detect variant
            const variant = this.detectTextFieldVariant(formControl);
            
            const confidence = this.adjustConfidence(
              MUI_CONFIDENCE.INPUT_LABEL,
              cleanedLabel,
              {
                lengthBonus: true,
                genericPenalty: true,
              }
            );
            
            return this.createResult(cleanedLabel, labelElement, 'framework', {
              confidence,
              selector,
              xpath: this.getXPath(labelElement),
              metadata: {
                framework: 'material-ui',
                patternType: 'input-label',
                isShrunk,
                variant,
              },
            });
          }
        }
      }
    }
    
    return null;
  }
  
  /**
   * Extract text from InputLabel, handling asterisks for required
   */
  private extractInputLabelText(labelElement: Element): string {
    // Clone to manipulate
    const clone = labelElement.cloneNode(true) as Element;
    
    // Remove required asterisk
    clone.querySelectorAll('.MuiInputLabel-asterisk, [class*="MuiFormLabel-asterisk"]')
      .forEach(el => el.remove());
    
    return getVisibleText(clone);
  }
  
  /**
   * Detect TextField variant (outlined/filled/standard)
   */
  private detectTextFieldVariant(formControl: Element): string {
    const className = formControl.className || '';
    
    for (const indicator of VARIANT_INDICATORS.OUTLINED) {
      if (className.includes(indicator) || formControl.querySelector(`[class*="${indicator}"]`)) {
        return 'outlined';
      }
    }
    
    for (const indicator of VARIANT_INDICATORS.FILLED) {
      if (className.includes(indicator) || formControl.querySelector(`[class*="${indicator}"]`)) {
        return 'filled';
      }
    }
    
    return 'standard';
  }
  
  // ==========================================================================
  // FORM LABEL DETECTION
  // ==========================================================================
  
  /**
   * Detect FormLabel (used in FormControl for grouped inputs)
   */
  private detectFormLabel(
    element: Element,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    // Find form control container
    let formControl: Element | null = null;
    
    for (const selector of FORM_CONTROL_SELECTORS) {
      formControl = element.closest(selector);
      if (formControl) break;
    }
    
    if (!formControl) {
      return null;
    }
    
    // Find FormLabel (different from InputLabel)
    for (const selector of LABEL_SELECTORS.FORM_LABEL) {
      const labelElement = formControl.querySelector(selector);
      
      // Skip if it's actually an InputLabel
      if (labelElement?.classList.contains('MuiInputLabel-root')) {
        continue;
      }
      
      if (labelElement) {
        const labelText = getVisibleText(labelElement);
        if (labelText) {
          const cleanedLabel = cleanLabelText(labelText);
          if (cleanedLabel) {
            const confidence = this.adjustConfidence(
              MUI_CONFIDENCE.FORM_LABEL,
              cleanedLabel,
              {
                lengthBonus: true,
                genericPenalty: true,
              }
            );
            
            return this.createResult(cleanedLabel, labelElement, 'framework', {
              confidence,
              selector,
              xpath: this.getXPath(labelElement),
              metadata: {
                framework: 'material-ui',
                patternType: 'form-label',
              },
            });
          }
        }
      }
    }
    
    return null;
  }
  
  // ==========================================================================
  // AUTOCOMPLETE DETECTION
  // ==========================================================================
  
  /**
   * Detect label in Autocomplete component
   */
  private detectAutocompleteLabel(
    element: Element,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    // Check if within Autocomplete
    const autocomplete = element.closest('.MuiAutocomplete-root, [class*="MuiAutocomplete"]');
    if (!autocomplete) {
      return null;
    }
    
    // Autocomplete often wraps a TextField, try InputLabel detection
    const formControl = autocomplete.querySelector('[class*="MuiFormControl"]');
    if (formControl) {
      for (const selector of LABEL_SELECTORS.INPUT_LABEL) {
        const labelElement = formControl.querySelector(selector);
        if (labelElement) {
          const labelText = this.extractInputLabelText(labelElement);
          if (labelText) {
            const cleanedLabel = cleanLabelText(labelText);
            if (cleanedLabel) {
              const confidence = this.adjustConfidence(
                MUI_CONFIDENCE.AUTOCOMPLETE,
                cleanedLabel,
                {
                  lengthBonus: true,
                  genericPenalty: true,
                }
              );
              
              return this.createResult(cleanedLabel, labelElement, 'framework', {
                confidence,
                selector,
                xpath: this.getXPath(labelElement),
                metadata: {
                  framework: 'material-ui',
                  patternType: 'autocomplete',
                },
              });
            }
          }
        }
      }
    }
    
    return null;
  }
  
  // ==========================================================================
  // PLACEHOLDER DETECTION
  // ==========================================================================
  
  /**
   * Detect placeholder as label (MUI-specific handling)
   */
  private detectPlaceholder(
    element: Element,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    // Check if element has placeholder
    const placeholder = element.getAttribute('placeholder');
    if (!placeholder) {
      return null;
    }
    
    // Only use if no InputLabel exists
    const formControl = element.closest('[class*="MuiFormControl"]');
    if (formControl) {
      const hasInputLabel = formControl.querySelector('[class*="MuiInputLabel"]');
      if (hasInputLabel && getVisibleText(hasInputLabel)) {
        return null; // Prefer InputLabel over placeholder
      }
    }
    
    const cleanedLabel = cleanLabelText(placeholder);
    if (!cleanedLabel) {
      return null;
    }
    
    const confidence = this.adjustConfidence(
      MUI_CONFIDENCE.PLACEHOLDER,
      cleanedLabel,
      {
        lengthBonus: true,
        genericPenalty: true,
      }
    );
    
    return this.createResult(cleanedLabel, element, 'attribute', {
      attribute: 'placeholder',
      confidence,
      metadata: {
        framework: 'material-ui',
        patternType: 'placeholder',
      },
    });
  }
  
  // ==========================================================================
  // HELPER TEXT DETECTION
  // ==========================================================================
  
  /**
   * Detect helper text as fallback label
   */
  private detectHelperText(
    element: Element,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    // Find form control container
    let formControl: Element | null = null;
    
    for (const selector of FORM_CONTROL_SELECTORS) {
      formControl = element.closest(selector);
      if (formControl) break;
    }
    
    if (!formControl) {
      return null;
    }
    
    // Find helper text
    for (const selector of LABEL_SELECTORS.HELPER_TEXT) {
      const helperElement = formControl.querySelector(selector);
      if (helperElement) {
        const helperText = getVisibleText(helperElement);
        if (helperText && helperText.length <= 100) {
          const cleanedLabel = cleanLabelText(helperText);
          if (cleanedLabel) {
            const confidence = this.adjustConfidence(
              MUI_CONFIDENCE.HELPER_TEXT,
              cleanedLabel,
              {
                lengthBonus: true,
                genericPenalty: true,
              }
            );
            
            return this.createResult(cleanedLabel, helperElement, 'framework', {
              confidence,
              selector,
              xpath: this.getXPath(helperElement),
              metadata: {
                framework: 'material-ui',
                patternType: 'helper-text',
                isHelperText: true,
              },
            });
          }
        }
      }
    }
    
    return null;
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a MaterialUIDetector instance
 */
export function createMaterialUIDetector(): MaterialUIDetector {
  return new MaterialUIDetector();
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if element is in a Material-UI page
 */
export function isMUIElement(element: Element): boolean {
  const detector = new MaterialUIDetector();
  return (detector as any).isMUIPage(element.ownerDocument);
}

/**
 * Get MUI version from page
 */
export function getMUIVersion(doc: Document): 'v5' | 'v4' | 'unknown' {
  const detector = new MaterialUIDetector();
  return (detector as any).detectMUIVersion(doc);
}

/**
 * Check if element is an MUI form control
 */
export function isMUIFormControl(element: Element): boolean {
  const className = element.className || '';
  return (
    className.includes('MuiInputBase') ||
    className.includes('MuiSelect') ||
    className.includes('MuiCheckbox') ||
    className.includes('MuiRadio') ||
    className.includes('MuiSwitch')
  );
}

/**
 * Find MUI form control container for element
 */
export function findMUIFormControl(element: Element): Element | null {
  for (const selector of FORM_CONTROL_SELECTORS) {
    const container = element.closest(selector);
    if (container) {
      return container;
    }
  }
  return null;
}

/**
 * Get TextField variant from element
 */
export function getMUITextFieldVariant(element: Element): 'outlined' | 'filled' | 'standard' {
  const formControl = findMUIFormControl(element);
  if (!formControl) {
    return 'standard';
  }
  
  const detector = new MaterialUIDetector();
  return (detector as any).detectTextFieldVariant(formControl);
}
