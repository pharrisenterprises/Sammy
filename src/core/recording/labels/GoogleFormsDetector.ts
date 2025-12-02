/**
 * GoogleFormsDetector - Google Forms-Specific Label Detection
 * @module core/recording/labels/GoogleFormsDetector
 * @version 1.0.0
 * 
 * Detects labels from Google Forms-specific DOM patterns.
 * Google Forms uses distinctive class names that allow high-confidence detection.
 * 
 * ## Confidence Scores (Highest)
 * - Question title: 0.95 (most reliable)
 * - Radio/checkbox labels: 0.90 (option text)
 * - Section headers: 0.85 (group labels)
 * 
 * ## Supported Patterns
 * - Short answer questions
 * - Paragraph questions
 * - Multiple choice (radio)
 * - Checkboxes
 * - Dropdown selections
 * - Linear scale
 * - Date/time pickers
 * - File upload
 * 
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
 * Confidence scores for Google Forms patterns
 */
export const GOOGLE_FORMS_CONFIDENCE = {
  /** Question title - most reliable */
  QUESTION_TITLE: 0.95,
  
  /** Radio/checkbox option text */
  OPTION_LABEL: 0.90,
  
  /** Dropdown option text */
  DROPDOWN_OPTION: 0.90,
  
  /** Section header */
  SECTION_HEADER: 0.85,
  
  /** Question description */
  DESCRIPTION: 0.80,
  
  /** Linear scale endpoint labels */
  SCALE_LABEL: 0.85,
} as const;

/**
 * Google Forms CSS class patterns for question titles
 */
export const QUESTION_TITLE_SELECTORS = [
  // Modern Google Forms (2020+)
  '.freebirdFormviewerComponentsQuestionBaseTitle',
  '.freebirdFormviewerComponentsQuestionBaseHeader',
  
  // Legacy Google Forms
  '.freebirdFormviewerViewItemsItemItemTitle',
  '.freebirdFormviewerViewItemsItemItemTitleContainer',
  
  // Alternative patterns
  '[data-params*="title"]',
  '.exportItemTitle',
  
  // Question number + title container
  '.freebirdFormviewerComponentsQuestionBaseTitleContainer',
] as const;

/**
 * Google Forms CSS class patterns for question containers
 */
export const QUESTION_CONTAINER_SELECTORS = [
  '.freebirdFormviewerViewItemsItemItem',
  '.freebirdFormviewerViewNumberedItemContainer',
  '.freebirdFormviewerComponentsQuestionBaseRoot',
  '[data-item-id]',
  '.freebirdFormviewerViewItemsItemItemHeader',
] as const;

/**
 * Google Forms CSS class patterns for input elements
 */
export const INPUT_SELECTORS = {
  /** Short answer text input */
  SHORT_TEXT: [
    '.freebirdFormviewerComponentsQuestionTextShort input',
    '.freebirdFormviewerComponentsQuestionTextRoot input[type="text"]',
    '.quantumWizTextinputPaperinputInput',
  ],
  
  /** Paragraph text input */
  PARAGRAPH: [
    '.freebirdFormviewerComponentsQuestionTextLong textarea',
    '.freebirdFormviewerComponentsQuestionTextRoot textarea',
    '.quantumWizTextinputPapertextareaInput',
  ],
  
  /** Multiple choice (radio) */
  RADIO: [
    '.freebirdFormviewerComponentsQuestionRadioChoice',
    '.freebirdFormviewerComponentsQuestionRadioRoot input[type="radio"]',
    '.docssharedWizToggleLabeledContainer',
  ],
  
  /** Checkboxes */
  CHECKBOX: [
    '.freebirdFormviewerComponentsQuestionCheckboxChoice',
    '.freebirdFormviewerComponentsQuestionCheckboxRoot input[type="checkbox"]',
  ],
  
  /** Dropdown */
  DROPDOWN: [
    '.freebirdFormviewerComponentsQuestionSelectRoot',
    '.quantumWizMenuPaperselectEl',
    '.freebirdFormviewerComponentsQuestionSelectSelect',
  ],
  
  /** Date picker */
  DATE: [
    '.freebirdFormviewerComponentsQuestionDateRoot',
    '.freebirdFormviewerComponentsQuestionDateInputsContainer input',
  ],
  
  /** Time picker */
  TIME: [
    '.freebirdFormviewerComponentsQuestionTimeRoot',
    '.freebirdFormviewerComponentsQuestionTimeInputsContainer input',
  ],
  
  /** Linear scale */
  SCALE: [
    '.freebirdFormviewerComponentsQuestionScaleRoot',
    '.freebirdFormviewerComponentsQuestionScaleChoice',
  ],
  
  /** File upload */
  FILE: [
    '.freebirdFormviewerComponentsQuestionFileuploadRoot',
    '.freebirdFormviewerComponentsQuestionFileuploadUploadButton',
  ],
} as const;

/**
 * Google Forms section patterns
 */
export const SECTION_SELECTORS = [
  '.freebirdFormviewerViewItemsSectionheaderHeader',
  '.freebirdFormviewerViewItemsSectionheaderTitle',
  '.freebirdFormviewerViewItemsPagebreakItemHeader',
] as const;

/**
 * Google Forms description patterns
 */
export const DESCRIPTION_SELECTORS = [
  '.freebirdFormviewerComponentsQuestionBaseDescription',
  '.freebirdFormviewerViewItemsItemItemHelpText',
  '.freebirdFormviewerViewItemsSectionheaderDescriptionText',
] as const;

/**
 * Google Forms option label patterns (for radio/checkbox)
 */
export const OPTION_LABEL_SELECTORS = [
  '.docssharedWizToggleLabeledLabelText',
  '.freebirdFormviewerComponentsQuestionRadioLabel',
  '.freebirdFormviewerComponentsQuestionCheckboxLabel',
  '.exportLabel',
] as const;

// ============================================================================
// GOOGLE FORMS DETECTOR CLASS
// ============================================================================

/**
 * Detects labels from Google Forms DOM patterns
 * 
 * @example
 * ```typescript
 * const detector = new GoogleFormsDetector();
 * 
 * // Element inside a Google Forms question
 * const input = document.querySelector('.freebirdFormviewerComponentsQuestionTextShort input');
 * 
 * const context = createDetectionContext(input);
 * const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
 * // result.label === 'Your Email Address'
 * // result.confidence === 0.95
 * ```
 */
export class GoogleFormsDetector extends BaseLabelDetector {
  constructor() {
    super(
      'google-forms',
      DETECTOR_PRIORITIES.FRAMEWORK,
      CONFIDENCE_SCORES.GOOGLE_FORMS,
      'Detects labels from Google Forms-specific DOM patterns'
    );
  }
  
  /**
   * Check if page/element appears to be Google Forms
   */
  canDetect(context: LabelDetectionContext): boolean {
    const { element, document: doc } = context;
    
    // Quick check: is this a Google Forms page?
    if (!this.isGoogleFormsPage(doc)) {
      return false;
    }
    
    // Check if element is within a Google Forms question
    return this.isWithinGoogleFormsQuestion(element);
  }
  
  /**
   * Detect label from Google Forms patterns
   */
  protected doDetect(
    context: LabelDetectionContext,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    const { element } = context;
    
    // Try to detect question title (highest priority)
    const questionResult = this.detectQuestionTitle(element, options);
    if (questionResult) {
      return questionResult;
    }
    
    // Try to detect option label (for radio/checkbox)
    const optionResult = this.detectOptionLabel(element, options);
    if (optionResult) {
      return optionResult;
    }
    
    // Try to detect section header
    const sectionResult = this.detectSectionHeader(element, options);
    if (sectionResult) {
      return sectionResult;
    }
    
    // Try to detect from description
    const descriptionResult = this.detectDescription(element, options);
    if (descriptionResult) {
      return descriptionResult;
    }
    
    // Try to detect scale labels
    const scaleResult = this.detectScaleLabel(element, options);
    if (scaleResult) {
      return scaleResult;
    }
    
    return null;
  }
  
  // ==========================================================================
  // PAGE DETECTION
  // ==========================================================================
  
  /**
   * Check if document is a Google Forms page
   */
  private isGoogleFormsPage(doc: Document): boolean {
    // Check URL
    const url = doc.location?.href || '';
    if (url.includes('docs.google.com/forms') || url.includes('forms.gle')) {
      return true;
    }
    
    // Check for Google Forms root elements
    const hasFormsRoot = doc.querySelector('.freebirdFormviewerViewFormCard') !== null;
    if (hasFormsRoot) {
      return true;
    }
    
    // Check for Google Forms scripts
    const hasFormsScript = doc.querySelector('script[src*="forms.google.com"]') !== null;
    if (hasFormsScript) {
      return true;
    }
    
    // Check for multiple Google Forms class patterns
    const formsClassCount = QUESTION_CONTAINER_SELECTORS.filter(
      selector => doc.querySelector(selector) !== null
    ).length;
    
    return formsClassCount >= 2;
  }
  
  /**
   * Check if element is within a Google Forms question
   */
  private isWithinGoogleFormsQuestion(element: Element): boolean {
    // Check if element or ancestor matches question container
    for (const selector of QUESTION_CONTAINER_SELECTORS) {
      if (element.matches(selector) || element.closest(selector)) {
        return true;
      }
    }
    
    // Check for Google Forms-specific classes on element
    const className = element.className || '';
    if (className.includes('freebird') || className.includes('quantumWiz')) {
      return true;
    }
    
    return false;
  }
  
  // ==========================================================================
  // QUESTION TITLE DETECTION
  // ==========================================================================
  
  /**
   * Detect question title label
   */
  private detectQuestionTitle(
    element: Element,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    // Find the question container
    const container = this.findQuestionContainer(element);
    if (!container) {
      return null;
    }
    
    // Find the title element within container
    for (const selector of QUESTION_TITLE_SELECTORS) {
      const titleElement = container.querySelector(selector);
      if (titleElement) {
        const titleText = this.extractTitleText(titleElement);
        if (titleText) {
          const cleanedLabel = cleanLabelText(titleText);
          if (cleanedLabel) {
            const confidence = this.adjustConfidence(
              GOOGLE_FORMS_CONFIDENCE.QUESTION_TITLE,
              cleanedLabel,
              {
                lengthBonus: true,
                genericPenalty: true,
              }
            );
            
            return this.createResult(cleanedLabel, titleElement, 'framework', {
              confidence,
              selector,
              xpath: this.getXPath(titleElement),
              metadata: {
                framework: 'google-forms',
                patternType: 'question-title',
                questionType: this.detectQuestionType(container),
              },
            });
          }
        }
      }
    }
    
    return null;
  }
  
  /**
   * Find the question container for an element
   */
  private findQuestionContainer(element: Element): Element | null {
    for (const selector of QUESTION_CONTAINER_SELECTORS) {
      const container = element.closest(selector);
      if (container) {
        return container;
      }
    }
    return null;
  }
  
  /**
   * Extract text from title element, handling nested structure
   */
  private extractTitleText(titleElement: Element): string {
    // Clone to manipulate
    const clone = titleElement.cloneNode(true) as Element;
    
    // Remove required indicator (*) spans
    clone.querySelectorAll('.freebirdFormviewerComponentsQuestionBaseRequiredAsterisk').forEach(el => el.remove());
    clone.querySelectorAll('[aria-label="Required question"]').forEach(el => el.remove());
    
    // Remove question numbers if present
    clone.querySelectorAll('.freebirdFormviewerComponentsQuestionBaseNumber').forEach(el => el.remove());
    
    // Get remaining text
    return getVisibleText(clone);
  }
  
  /**
   * Detect the type of question
   */
  private detectQuestionType(container: Element): string {
    // Check for different input types
    if (container.querySelector(INPUT_SELECTORS.SHORT_TEXT.join(','))) {
      return 'short-answer';
    }
    if (container.querySelector(INPUT_SELECTORS.PARAGRAPH.join(','))) {
      return 'paragraph';
    }
    if (container.querySelector(INPUT_SELECTORS.RADIO.join(','))) {
      return 'multiple-choice';
    }
    if (container.querySelector(INPUT_SELECTORS.CHECKBOX.join(','))) {
      return 'checkboxes';
    }
    if (container.querySelector(INPUT_SELECTORS.DROPDOWN.join(','))) {
      return 'dropdown';
    }
    if (container.querySelector(INPUT_SELECTORS.DATE.join(','))) {
      return 'date';
    }
    if (container.querySelector(INPUT_SELECTORS.TIME.join(','))) {
      return 'time';
    }
    if (container.querySelector(INPUT_SELECTORS.SCALE.join(','))) {
      return 'linear-scale';
    }
    if (container.querySelector(INPUT_SELECTORS.FILE.join(','))) {
      return 'file-upload';
    }
    
    return 'unknown';
  }
  
  // ==========================================================================
  // OPTION LABEL DETECTION
  // ==========================================================================
  
  /**
   * Detect option label for radio/checkbox
   */
  private detectOptionLabel(
    element: Element,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    // Check if element is a radio or checkbox
    const isRadio = element.matches('input[type="radio"]') || 
                    element.closest('.freebirdFormviewerComponentsQuestionRadioChoice');
    const isCheckbox = element.matches('input[type="checkbox"]') ||
                       element.closest('.freebirdFormviewerComponentsQuestionCheckboxChoice');
    
    if (!isRadio && !isCheckbox) {
      return null;
    }
    
    // Find the option container
    const optionContainer = element.closest('.docssharedWizToggleLabeledContainer') ||
                           element.closest('.freebirdFormviewerComponentsQuestionRadioChoice') ||
                           element.closest('.freebirdFormviewerComponentsQuestionCheckboxChoice');
    
    if (!optionContainer) {
      return null;
    }
    
    // Find the option label
    for (const selector of OPTION_LABEL_SELECTORS) {
      const labelElement = optionContainer.querySelector(selector);
      if (labelElement) {
        const labelText = getVisibleText(labelElement);
        if (labelText) {
          const cleanedLabel = cleanLabelText(labelText);
          if (cleanedLabel) {
            // Also get the question title for context
            const questionTitle = this.getParentQuestionTitle(element);
            const fullLabel = questionTitle 
              ? `${questionTitle}: ${cleanedLabel}`
              : cleanedLabel;
            
            const confidence = this.adjustConfidence(
              GOOGLE_FORMS_CONFIDENCE.OPTION_LABEL,
              cleanedLabel,
              {
                lengthBonus: true,
                genericPenalty: true,
              }
            );
            
            return this.createResult(fullLabel, labelElement, 'framework', {
              confidence,
              selector,
              xpath: this.getXPath(labelElement),
              metadata: {
                framework: 'google-forms',
                patternType: isRadio ? 'radio-option' : 'checkbox-option',
                optionText: cleanedLabel,
                questionTitle,
              },
            });
          }
        }
      }
    }
    
    return null;
  }
  
  /**
   * Get the parent question's title
   */
  private getParentQuestionTitle(element: Element): string | null {
    const container = this.findQuestionContainer(element);
    if (!container) {
      return null;
    }
    
    for (const selector of QUESTION_TITLE_SELECTORS) {
      const titleElement = container.querySelector(selector);
      if (titleElement) {
        const text = this.extractTitleText(titleElement);
        if (text) {
          return cleanLabelText(text);
        }
      }
    }
    
    return null;
  }
  
  // ==========================================================================
  // SECTION HEADER DETECTION
  // ==========================================================================
  
  /**
   * Detect section header label
   */
  private detectSectionHeader(
    element: Element,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    // Check if element is within a section header
    for (const selector of SECTION_SELECTORS) {
      const sectionElement = element.closest(selector);
      if (sectionElement) {
        const headerText = getVisibleText(sectionElement);
        if (headerText) {
          const cleanedLabel = cleanLabelText(headerText);
          if (cleanedLabel) {
            const confidence = this.adjustConfidence(
              GOOGLE_FORMS_CONFIDENCE.SECTION_HEADER,
              cleanedLabel,
              {
                lengthBonus: true,
              }
            );
            
            return this.createResult(cleanedLabel, sectionElement, 'framework', {
              confidence,
              selector,
              xpath: this.getXPath(sectionElement),
              metadata: {
                framework: 'google-forms',
                patternType: 'section-header',
              },
            });
          }
        }
      }
    }
    
    return null;
  }
  
  // ==========================================================================
  // DESCRIPTION DETECTION
  // ==========================================================================
  
  /**
   * Detect description as label (fallback)
   */
  private detectDescription(
    element: Element,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    const container = this.findQuestionContainer(element);
    if (!container) {
      return null;
    }
    
    for (const selector of DESCRIPTION_SELECTORS) {
      const descElement = container.querySelector(selector);
      if (descElement) {
        const descText = getVisibleText(descElement);
        if (descText && descText.length <= 100) {
          const cleanedLabel = cleanLabelText(descText);
          if (cleanedLabel) {
            const confidence = this.adjustConfidence(
              GOOGLE_FORMS_CONFIDENCE.DESCRIPTION,
              cleanedLabel,
              {
                lengthBonus: true,
                genericPenalty: true,
              }
            );
            
            return this.createResult(cleanedLabel, descElement, 'framework', {
              confidence,
              selector,
              xpath: this.getXPath(descElement),
              metadata: {
                framework: 'google-forms',
                patternType: 'description',
              },
            });
          }
        }
      }
    }
    
    return null;
  }
  
  // ==========================================================================
  // SCALE LABEL DETECTION
  // ==========================================================================
  
  /**
   * Detect linear scale endpoint labels
   */
  private detectScaleLabel(
    element: Element,
    options: LabelDetectionOptions
  ): LabelDetectionResult | null {
    // Check if element is within a scale question
    const scaleContainer = element.closest('.freebirdFormviewerComponentsQuestionScaleRoot');
    if (!scaleContainer) {
      return null;
    }
    
    // Get question title first
    const questionTitle = this.getParentQuestionTitle(element);
    
    // Find scale value labels
    const lowLabel = scaleContainer.querySelector('.freebirdFormviewerComponentsQuestionScaleLowLabel');
    const highLabel = scaleContainer.querySelector('.freebirdFormviewerComponentsQuestionScaleHighLabel');
    
    // Get the specific scale option being selected
    const scaleChoice = element.closest('.freebirdFormviewerComponentsQuestionScaleChoice');
    if (scaleChoice) {
      const value = scaleChoice.getAttribute('data-value') || 
                    scaleChoice.querySelector('input')?.value;
      
      let label = questionTitle || 'Scale';
      if (value) {
        label = `${label}: ${value}`;
      }
      
      // Add endpoint context if available
      const lowText = lowLabel ? getVisibleText(lowLabel) : '';
      const highText = highLabel ? getVisibleText(highLabel) : '';
      
      const confidence = this.adjustConfidence(
        GOOGLE_FORMS_CONFIDENCE.SCALE_LABEL,
        label,
        {
          lengthBonus: true,
        }
      );
      
      return this.createResult(label, scaleChoice, 'framework', {
        confidence,
        xpath: this.getXPath(scaleChoice),
        metadata: {
          framework: 'google-forms',
          patternType: 'scale-option',
          scaleValue: value,
          lowLabel: lowText,
          highLabel: highText,
        },
      });
    }
    
    return null;
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a GoogleFormsDetector instance
 */
export function createGoogleFormsDetector(): GoogleFormsDetector {
  return new GoogleFormsDetector();
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if element is on a Google Forms page
 */
export function isGoogleFormsElement(element: Element): boolean {
  const detector = new GoogleFormsDetector();
  return (detector as any).isGoogleFormsPage(element.ownerDocument) &&
         (detector as any).isWithinGoogleFormsQuestion(element);
}

/**
 * Get the question title for a Google Forms element
 */
export function getGoogleFormsQuestionTitle(element: Element): string | null {
  const detector = new GoogleFormsDetector();
  return (detector as any).getParentQuestionTitle(element);
}

/**
 * Get the question type for a Google Forms element
 */
export function getGoogleFormsQuestionType(element: Element): string | null {
  const detector = new GoogleFormsDetector();
  const container = (detector as any).findQuestionContainer(element);
  if (!container) {
    return null;
  }
  return (detector as any).detectQuestionType(container);
}

/**
 * Check if page URL indicates Google Forms
 */
export function isGoogleFormsUrl(url: string): boolean {
  return url.includes('docs.google.com/forms') || 
         url.includes('forms.gle') ||
         url.includes('forms.google.com');
}
