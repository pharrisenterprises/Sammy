/**
 * BootstrapDetector - Bootstrap CSS Framework Label Detection
 * @module core/recording/labels/BootstrapDetector
 * @version 1.0.0
 * 
 * Detects labels from Bootstrap CSS framework form patterns.
 * Supports both Bootstrap 4 and Bootstrap 5 class naming conventions.
 * 
 * ## Confidence Scores
 * - Form label (.form-label): 0.75
 * - Floating label: 0.75
 * - Form check label: 0.75
 * - Input group text: 0.70
 * - Control label (BS4): 0.70
 * 
 * ## Supported Patterns
 * - Standard form groups (.mb-3, .form-group)
 * - Floating labels (.form-floating)
 * - Input groups (.input-group)
 * - Form checks (.form-check)
 * - Horizontal forms (.row with .col-form-label)
 * 
 * @see https://getbootstrap.com/docs/5.3/forms/overview/
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
 * Confidence scores for Bootstrap patterns
 */
export const BOOTSTRAP_CONFIDENCE = {
  /** Standard form-label */
  FORM_LABEL: 0.75,
  
  /** Floating label */
  FLOATING_LABEL: 0.75,
  
  /** Form check label (checkbox/radio) */
  FORM_CHECK_LABEL: 0.75,
  
  /** Horizontal form label */
  COL_FORM_LABEL: 0.75,
  
  /** Input group text */
  INPUT_GROUP_TEXT: 0.70,
  
  /** Bootstrap 4 control-label */
  CONTROL_LABEL: 0.70,
  
  /** Help text as fallback */
  FORM_TEXT: 0.55,
} as const;

/**
 * Bootstrap form container selectors
 */
export const FORM_CONTAINER_SELECTORS = [
  // Bootstrap 5
  '.mb-3',
  '.mb-2',
  '.mb-4',
  '.form-floating',
  '.input-group',
  '.form-check',
  
  // Bootstrap 4
  '.form-group',
  '.form-row',
  
  // Common row-based layouts
  '.row',
] as const;

/**
 * Bootstrap label selectors
 */
export const LABEL_SELECTORS = {
  /** Bootstrap 5 standard label */
  FORM_LABEL: '.form-label',
  
  /** Bootstrap 5 floating label */
  FLOATING_LABEL: '.form-floating > label',
  
  /** Bootstrap 5 check label */
  FORM_CHECK_LABEL: '.form-check-label',
  
  /** Bootstrap 4 control label */
  CONTROL_LABEL: '.control-label',
  
  /** Horizontal form label */
  COL_FORM_LABEL: '.col-form-label',
  
  /** Input group prepend/append text */
  INPUT_GROUP_TEXT: '.input-group-text',
  
  /** Help text */
  FORM_TEXT: '.form-text',
} as const;

/**
 * Bootstrap input selectors
 */
export const INPUT_SELECTORS = [
  '.form-control',
  '.form-select',
  '.form-check-input',
  '.form-range',
  'input',
  'select',
  'textarea',
] as const;

/**
 * Bootstrap version indicators
 */
export const VERSION_INDICATORS = {
  /** Bootstrap 5 specific classes */
  BS5: [
    'form-label',
    'form-floating',
    'form-select',
    'form-check',
    'form-switch',
    'form-range',
    'visually-hidden',
  ],
  
  /** Bootstrap 4 specific classes */
  BS4: [
    'form-group',
    'control-label',
    'custom-control',
    'custom-select',
    'custom-checkbox',
    'custom-radio',
    'sr-only',
  ],
} as const;

// ============================================================================
// BOOTSTRAP DETECTOR CLASS
// ============================================================================

/**
 * Detects labels from Bootstrap CSS framework patterns
 * 
 * @example
 * ```typescript
 * const detector = new BootstrapDetector();
 * 
 * // Bootstrap 5 form
 * // <div class="mb-3">
 * //   <label class="form-label">Email</label>
 * //   <input class="form-control">
 * // </div>
 * const input = document.querySelector('.form-control');
 * 
 * const context = createDetectionContext(input);
 * const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
 * // result.label === 'Email'
 * // result.confidence === 0.75
 * ```
 */
export class BootstrapDetector extends BaseLabelDetector {
  constructor() {
    super(
      'bootstrap',
      DETECTOR_PRIORITIES.CSS_FRAMEWORK,
      CONFIDENCE_SCORES.BOOTSTRAP,
      'Detects labels from Bootstrap CSS framework form patterns'
    );
  }
  
  /**
   * Check if page uses Bootstrap and element is within Bootstrap form
   */
  canDetect(context: LabelDetectionContext): boolean {
    const { element, document: doc } = context;
    
    // Quick check: is Bootstrap present on page?
    if (!this.isBootstrapPage(doc)) {
      return false;
    }
    
    // Check if element is within a Bootstrap form structure
    return this.isWithinBootstrapForm(element);
  }
  
  /**
   * Detect label from Bootstrap patterns
   */
  protected doDetect(
    context: LabelDetectionContext,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    const { element } = context;
    
    // Detect Bootstrap version for context
    const version = this.detectBootstrapVersion(element.ownerDocument);
    
    // Try floating label first (highest specificity)
    const floatingResult = this.detectFloatingLabel(element, options);
    if (floatingResult) {
      return this.addVersionMetadata(floatingResult, version);
    }
    
    // Try form check label (checkbox/radio)
    const formCheckResult = this.detectFormCheckLabel(element, options);
    if (formCheckResult) {
      return this.addVersionMetadata(formCheckResult, version);
    }
    
    // Try standard form label
    const formLabelResult = this.detectFormLabel(element, options);
    if (formLabelResult) {
      return this.addVersionMetadata(formLabelResult, version);
    }
    
    // Try horizontal form label
    const colLabelResult = this.detectColFormLabel(element, options);
    if (colLabelResult) {
      return this.addVersionMetadata(colLabelResult, version);
    }
    
    // Try input group text
    const inputGroupResult = this.detectInputGroupText(element, options);
    if (inputGroupResult) {
      return this.addVersionMetadata(inputGroupResult, version);
    }
    
    // Try Bootstrap 4 control label
    const controlLabelResult = this.detectControlLabel(element, options);
    if (controlLabelResult) {
      return this.addVersionMetadata(controlLabelResult, version);
    }
    
    // Try form text as last resort
    const formTextResult = this.detectFormText(element, options);
    if (formTextResult) {
      return this.addVersionMetadata(formTextResult, version);
    }
    
    return null;
  }
  
  // ==========================================================================
  // PAGE DETECTION
  // ==========================================================================
  
  /**
   * Check if page uses Bootstrap
   */
  private isBootstrapPage(doc: Document): boolean {
    // Check for Bootstrap CSS file
    const hasBootstrapCSS = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'))
      .some(link => {
        const href = (link as HTMLLinkElement).href || '';
        return href.includes('bootstrap') || href.includes('bs5') || href.includes('bs4');
      });
    
    if (hasBootstrapCSS) {
      return true;
    }
    
    // Check for Bootstrap-specific classes
    const hasFormControl = doc.querySelector('.form-control') !== null;
    const hasFormGroup = doc.querySelector('.form-group') !== null;
    const hasFormLabel = doc.querySelector('.form-label') !== null;
    const hasMb3 = doc.querySelector('.mb-3') !== null;
    
    // Need at least 2 Bootstrap indicators
    const indicators = [hasFormControl, hasFormGroup, hasFormLabel, hasMb3];
    return indicators.filter(Boolean).length >= 2;
  }
  
  /**
   * Check if element is within a Bootstrap form structure
   */
  private isWithinBootstrapForm(element: Element): boolean {
    // Check for Bootstrap form classes on element
    const hasBootstrapClass = element.className && (
      element.className.includes('form-control') ||
      element.className.includes('form-select') ||
      element.className.includes('form-check-input') ||
      element.className.includes('form-range')
    );
    
    if (hasBootstrapClass) {
      return true;
    }
    
    // Check if within Bootstrap container
    for (const selector of FORM_CONTAINER_SELECTORS) {
      if (element.closest(selector)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Detect Bootstrap version
   */
  private detectBootstrapVersion(doc: Document): 'bs5' | 'bs4' | 'unknown' {
    // Check for BS5 specific classes
    for (const cls of VERSION_INDICATORS.BS5) {
      if (doc.querySelector(`.${cls}`)) {
        return 'bs5';
      }
    }
    
    // Check for BS4 specific classes
    for (const cls of VERSION_INDICATORS.BS4) {
      if (doc.querySelector(`.${cls}`)) {
        return 'bs4';
      }
    }
    
    return 'unknown';
  }
  
  /**
   * Add version metadata to result
   */
  private addVersionMetadata(
    result: LabelDetectionResult,
    version: 'bs5' | 'bs4' | 'unknown'
  ): LabelDetectionResult {
    return {
      ...result,
      metadata: {
        ...result.metadata,
        extra: {
          ...result.metadata?.extra,
          bootstrapVersion: version,
        },
      },
    };
  }
  
  // ==========================================================================
  // FLOATING LABEL DETECTION
  // ==========================================================================
  
  /**
   * Detect floating label (Bootstrap 5)
   * 
   * Pattern: <div class="form-floating">
   *            <input class="form-control">
   *            <label>Email</label>
   *          </div>
   */
  private detectFloatingLabel(
    element: Element,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    const floatingContainer = element.closest('.form-floating');
    if (!floatingContainer) {
      return null;
    }
    
    // In floating labels, the label comes AFTER the input
    const label = floatingContainer.querySelector('label');
    if (!label) {
      return null;
    }
    
    const labelText = getVisibleText(label);
    if (!labelText) {
      return null;
    }
    
    const cleanedLabel = cleanLabelText(labelText);
    if (!cleanedLabel) {
      return null;
    }
    
    const confidence = this.adjustConfidence(
      BOOTSTRAP_CONFIDENCE.FLOATING_LABEL,
      cleanedLabel,
      {
        lengthBonus: true,
        genericPenalty: true,
      }
    );
    
    return this.createResult(cleanedLabel, label, 'framework', {
      confidence,
      selector: '.form-floating > label',
      xpath: this.getXPath(label),
      metadata: {
        framework: 'bootstrap',
        patternType: 'floating-label',
      },
    });
  }
  
  // ==========================================================================
  // FORM CHECK LABEL DETECTION
  // ==========================================================================
  
  /**
   * Detect form check label (checkbox/radio)
   * 
   * Pattern: <div class="form-check">
   *            <input class="form-check-input" type="checkbox">
   *            <label class="form-check-label">Remember me</label>
   *          </div>
   */
  private detectFormCheckLabel(
    element: Element,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    // Must be a checkbox or radio input
    if (!(element instanceof HTMLInputElement)) {
      return null;
    }
    
    const type = element.type?.toLowerCase();
    if (type !== 'checkbox' && type !== 'radio') {
      return null;
    }
    
    const formCheck = element.closest('.form-check');
    if (!formCheck) {
      // Also try custom-control (BS4)
      const customControl = element.closest('.custom-control');
      if (!customControl) {
        return null;
      }
      
      // Look for custom-control-label
      const label = customControl.querySelector('.custom-control-label');
      if (label) {
        return this.createLabelResult(
          label,
          BOOTSTRAP_CONFIDENCE.FORM_CHECK_LABEL,
          'custom-control-label',
          'form-check'
        );
      }
      return null;
    }
    
    // Find form-check-label
    const label = formCheck.querySelector('.form-check-label');
    if (label) {
      return this.createLabelResult(
        label,
        BOOTSTRAP_CONFIDENCE.FORM_CHECK_LABEL,
        '.form-check-label',
        'form-check'
      );
    }
    
    // Fallback to any label in form-check
    const anyLabel = formCheck.querySelector('label');
    if (anyLabel) {
      return this.createLabelResult(
        anyLabel,
        BOOTSTRAP_CONFIDENCE.FORM_CHECK_LABEL - 0.05,
        'label',
        'form-check'
      );
    }
    
    return null;
  }
  
  // ==========================================================================
  // FORM LABEL DETECTION
  // ==========================================================================
  
  /**
   * Detect standard form label
   * 
   * Pattern: <div class="mb-3">
   *            <label class="form-label">Email</label>
   *            <input class="form-control">
   *          </div>
   */
  private detectFormLabel(
    element: Element,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    // Find form container
    const container = this.findFormContainer(element);
    if (!container) {
      return null;
    }
    
    // Look for form-label
    const formLabel = container.querySelector('.form-label');
    if (formLabel) {
      return this.createLabelResult(
        formLabel,
        BOOTSTRAP_CONFIDENCE.FORM_LABEL,
        '.form-label',
        'standard'
      );
    }
    
    // Look for any label before the input
    const labels = container.querySelectorAll('label');
    for (const label of labels) {
      // Skip if it's a floating label (comes after input)
      if (container.classList.contains('form-floating')) {
        continue;
      }
      
      // Skip form-check-label
      if (label.classList.contains('form-check-label')) {
        continue;
      }
      
      // Check if label comes before input in DOM
      const labelRect = label.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      
      if (labelRect.top <= elementRect.top || labelRect.left < elementRect.left) {
        return this.createLabelResult(
          label,
          BOOTSTRAP_CONFIDENCE.FORM_LABEL - 0.05,
          'label',
          'standard'
        );
      }
    }
    
    return null;
  }
  
  /**
   * Find Bootstrap form container for element
   */
  private findFormContainer(element: Element): Element | null {
    for (const selector of FORM_CONTAINER_SELECTORS) {
      const container = element.closest(selector);
      if (container) {
        return container;
      }
    }
    return null;
  }
  
  // ==========================================================================
  // HORIZONTAL FORM LABEL DETECTION
  // ==========================================================================
  
  /**
   * Detect horizontal form label
   * 
   * Pattern: <div class="row mb-3">
   *            <label class="col-sm-2 col-form-label">Email</label>
   *            <div class="col-sm-10">
   *              <input class="form-control">
   *            </div>
   *          </div>
   */
  private detectColFormLabel(
    element: Element,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    const row = element.closest('.row');
    if (!row) {
      return null;
    }
    
    // Look for col-form-label
    const colLabel = row.querySelector('.col-form-label');
    if (colLabel) {
      return this.createLabelResult(
        colLabel,
        BOOTSTRAP_CONFIDENCE.COL_FORM_LABEL,
        '.col-form-label',
        'horizontal'
      );
    }
    
    return null;
  }
  
  // ==========================================================================
  // INPUT GROUP DETECTION
  // ==========================================================================
  
  /**
   * Detect input group text as label
   * 
   * Pattern: <div class="input-group">
   *            <span class="input-group-text">@</span>
   *            <input class="form-control">
   *          </div>
   */
  private detectInputGroupText(
    element: Element,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    const inputGroup = element.closest('.input-group');
    if (!inputGroup) {
      return null;
    }
    
    // Find input-group-text elements
    const textElements = inputGroup.querySelectorAll('.input-group-text');
    if (textElements.length === 0) {
      return null;
    }
    
    // Prefer text before input (prepend), then after (append)
    let prependText: Element | null = null;
    let appendText: Element | null = null;
    
    const children = Array.from(inputGroup.children);
    const inputIndex = children.indexOf(element.closest('.input-group > *') || element);
    
    for (const textEl of textElements) {
      const textIndex = children.indexOf(textEl);
      if (textIndex < inputIndex) {
        prependText = textEl;
      } else if (textIndex > inputIndex) {
        appendText = appendText || textEl;
      }
    }
    
    // Use prepend text if available
    const labelElement = prependText || appendText;
    if (!labelElement) {
      return null;
    }
    
    const text = getVisibleText(labelElement);
    if (!text || text.length > 50) {
      return null; // Skip if too long (probably not a label)
    }
    
    const cleanedLabel = cleanLabelText(text);
    if (!cleanedLabel) {
      return null;
    }
    
    // Lower confidence for single characters (like @, $, etc.)
    let confidence = BOOTSTRAP_CONFIDENCE.INPUT_GROUP_TEXT;
    if (cleanedLabel.length <= 2) {
      confidence -= 0.10;
    }
    
    confidence = this.adjustConfidence(confidence, cleanedLabel, {
      lengthBonus: true,
      genericPenalty: true,
    });
    
    return this.createResult(cleanedLabel, labelElement, 'framework', {
      confidence,
      selector: '.input-group-text',
      xpath: this.getXPath(labelElement),
      metadata: {
        framework: 'bootstrap',
        patternType: 'input-group',
        position: prependText ? 'prepend' : 'append',
      },
    });
  }
  
  // ==========================================================================
  // BOOTSTRAP 4 CONTROL LABEL DETECTION
  // ==========================================================================
  
  /**
   * Detect Bootstrap 4 control-label
   * 
   * Pattern: <div class="form-group">
   *            <label class="control-label">Email</label>
   *            <input class="form-control">
   *          </div>
   */
  private detectControlLabel(
    element: Element,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    const formGroup = element.closest('.form-group');
    if (!formGroup) {
      return null;
    }
    
    const controlLabel = formGroup.querySelector('.control-label');
    if (controlLabel) {
      return this.createLabelResult(
        controlLabel,
        BOOTSTRAP_CONFIDENCE.CONTROL_LABEL,
        '.control-label',
        'bs4-standard'
      );
    }
    
    return null;
  }
  
  // ==========================================================================
  // FORM TEXT (HELP TEXT) DETECTION
  // ==========================================================================
  
  /**
   * Detect form text as fallback
   * 
   * Pattern: <div class="mb-3">
   *            <input class="form-control">
   *            <div class="form-text">We'll never share your email.</div>
   *          </div>
   */
  private detectFormText(
    element: Element,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    const container = this.findFormContainer(element);
    if (!container) {
      return null;
    }
    
    // form-text is usually help text, not label - low confidence
    const formText = container.querySelector('.form-text, .help-block');
    if (!formText) {
      return null;
    }
    
    const text = getVisibleText(formText);
    if (!text || text.length > 100) {
      return null;
    }
    
    const cleanedLabel = cleanLabelText(text);
    if (!cleanedLabel) {
      return null;
    }
    
    const confidence = this.adjustConfidence(
      BOOTSTRAP_CONFIDENCE.FORM_TEXT,
      cleanedLabel,
      {
        lengthBonus: true,
        genericPenalty: true,
      }
    );
    
    return this.createResult(cleanedLabel, formText, 'framework', {
      confidence,
      selector: '.form-text',
      xpath: this.getXPath(formText),
      metadata: {
        framework: 'bootstrap',
        patternType: 'help-text',
        isHelpText: true,
      },
    });
  }
  
  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================
  
  /**
   * Create a label result from element
   */
  private createLabelResult(
    labelElement: Element,
    baseConfidence: number,
    selector: string,
    patternType: string
  ): LabelDetectionResult | null {
    const text = getVisibleText(labelElement);
    if (!text) {
      return null;
    }
    
    const cleanedLabel = cleanLabelText(text);
    if (!cleanedLabel) {
      return null;
    }
    
    const confidence = this.adjustConfidence(baseConfidence, cleanedLabel, {
      lengthBonus: true,
      genericPenalty: true,
    });
    
    return this.createResult(cleanedLabel, labelElement, 'framework', {
      confidence,
      selector,
      xpath: this.getXPath(labelElement),
      metadata: {
        framework: 'bootstrap',
        patternType,
      },
    });
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a BootstrapDetector instance
 */
export function createBootstrapDetector(): BootstrapDetector {
  return new BootstrapDetector();
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if element is in a Bootstrap page
 */
export function isBootstrapElement(element: Element): boolean {
  const detector = new BootstrapDetector();
  return (detector as any).isBootstrapPage(element.ownerDocument);
}

/**
 * Get Bootstrap version from page
 */
export function getBootstrapVersion(doc: Document): 'bs5' | 'bs4' | 'unknown' {
  const detector = new BootstrapDetector();
  return (detector as any).detectBootstrapVersion(doc);
}

/**
 * Check if element is a Bootstrap form control
 */
export function isBootstrapFormControl(element: Element): boolean {
  const className = element.className || '';
  return (
    className.includes('form-control') ||
    className.includes('form-select') ||
    className.includes('form-check-input') ||
    className.includes('form-range')
  );
}

/**
 * Find Bootstrap form container for element
 */
export function findBootstrapContainer(element: Element): Element | null {
  for (const selector of FORM_CONTAINER_SELECTORS) {
    const container = element.closest(selector);
    if (container) {
      return container;
    }
  }
  return null;
}
