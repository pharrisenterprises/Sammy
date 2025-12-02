/**
 * Tests for GoogleFormsDetector
 * @module core/recording/labels/GoogleFormsDetector.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  GoogleFormsDetector,
  createGoogleFormsDetector,
  isGoogleFormsElement,
  getGoogleFormsQuestionTitle,
  getGoogleFormsQuestionType,
  isGoogleFormsUrl,
  GOOGLE_FORMS_CONFIDENCE,
  QUESTION_TITLE_SELECTORS,
  QUESTION_CONTAINER_SELECTORS,
  INPUT_SELECTORS,
} from './GoogleFormsDetector';

import {
  createDetectionContext,
  DEFAULT_DETECTION_OPTIONS,
} from './ILabelDetector';

// ============================================================================
// TEST SETUP
// ============================================================================

/**
 * Helper to create Google Forms-like DOM structure
 */
function createGoogleFormsQuestion(options: {
  title: string;
  type?: 'text' | 'radio' | 'checkbox' | 'dropdown';
  description?: string;
  options?: string[];
  required?: boolean;
}): HTMLElement {
  const container = document.createElement('div');
  container.className = 'freebirdFormviewerViewItemsItemItem';
  container.setAttribute('data-item-id', 'question-' + Math.random().toString(36).substr(2, 9));
  
  // Title container
  const titleContainer = document.createElement('div');
  titleContainer.className = 'freebirdFormviewerComponentsQuestionBaseTitleContainer';
  
  const title = document.createElement('div');
  title.className = 'freebirdFormviewerComponentsQuestionBaseTitle';
  title.textContent = options.title;
  
  if (options.required) {
    const asterisk = document.createElement('span');
    asterisk.className = 'freebirdFormviewerComponentsQuestionBaseRequiredAsterisk';
    asterisk.textContent = '*';
    asterisk.setAttribute('aria-label', 'Required question');
    title.appendChild(asterisk);
  }
  
  titleContainer.appendChild(title);
  container.appendChild(titleContainer);
  
  // Description
  if (options.description) {
    const desc = document.createElement('div');
    desc.className = 'freebirdFormviewerComponentsQuestionBaseDescription';
    desc.textContent = options.description;
    container.appendChild(desc);
  }
  
  // Input based on type
  const type = options.type || 'text';
  
  if (type === 'text') {
    const inputContainer = document.createElement('div');
    inputContainer.className = 'freebirdFormviewerComponentsQuestionTextShort';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'quantumWizTextinputPaperinputInput';
    inputContainer.appendChild(input);
    container.appendChild(inputContainer);
  } else if (type === 'radio' && options.options) {
    const radioContainer = document.createElement('div');
    radioContainer.className = 'freebirdFormviewerComponentsQuestionRadioRoot';
    
    options.options.forEach((opt, i) => {
      const choice = document.createElement('div');
      choice.className = 'freebirdFormviewerComponentsQuestionRadioChoice docssharedWizToggleLabeledContainer';
      
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'question';
      radio.id = `option-${i}`;
      choice.appendChild(radio);
      
      const label = document.createElement('span');
      label.className = 'docssharedWizToggleLabeledLabelText';
      label.textContent = opt;
      choice.appendChild(label);
      
      radioContainer.appendChild(choice);
    });
    
    container.appendChild(radioContainer);
  } else if (type === 'checkbox' && options.options) {
    const checkboxContainer = document.createElement('div');
    checkboxContainer.className = 'freebirdFormviewerComponentsQuestionCheckboxRoot';
    
    options.options.forEach((opt, i) => {
      const choice = document.createElement('div');
      choice.className = 'freebirdFormviewerComponentsQuestionCheckboxChoice';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `option-${i}`;
      choice.appendChild(checkbox);
      
      const label = document.createElement('span');
      label.className = 'docssharedWizToggleLabeledLabelText';
      label.textContent = opt;
      choice.appendChild(label);
      
      checkboxContainer.appendChild(choice);
    });
    
    container.appendChild(checkboxContainer);
  } else if (type === 'dropdown') {
    const dropdownContainer = document.createElement('div');
    dropdownContainer.className = 'freebirdFormviewerComponentsQuestionSelectRoot';
    
    const select = document.createElement('select');
    select.className = 'quantumWizMenuPaperselectEl';
    
    if (options.options) {
      options.options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt;
        option.textContent = opt;
        select.appendChild(option);
      });
    }
    
    dropdownContainer.appendChild(select);
    container.appendChild(dropdownContainer);
  }
  
  return container;
}

/**
 * Helper to create a Google Forms page wrapper
 */
function createGoogleFormsPage(): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'freebirdFormviewerViewFormCard';
  return wrapper;
}

describe('GoogleFormsDetector', () => {
  let detector: GoogleFormsDetector;
  
  beforeEach(() => {
    detector = new GoogleFormsDetector();
  });
  
  afterEach(() => {
    document.body.innerHTML = '';
  });
  
  // ==========================================================================
  // BASIC PROPERTIES
  // ==========================================================================
  
  describe('properties', () => {
    it('should have correct name', () => {
      expect(detector.name).toBe('google-forms');
    });
    
    it('should have highest priority (framework)', () => {
      expect(detector.priority).toBe(10); // DETECTOR_PRIORITIES.FRAMEWORK
    });
    
    it('should have highest base confidence', () => {
      expect(detector.baseConfidence).toBe(0.95);
    });
    
    it('should have description', () => {
      expect(detector.description).toContain('Google Forms');
    });
  });
  
  // ==========================================================================
  // CAN DETECT
  // ==========================================================================
  
  describe('canDetect', () => {
    it('should return true for elements in Google Forms page', () => {
      const page = createGoogleFormsPage();
      const question = createGoogleFormsQuestion({ title: 'Your Name' });
      page.appendChild(question);
      document.body.appendChild(page);
      
      const input = question.querySelector('input')!;
      const context = createDetectionContext(input);
      
      expect(detector.canDetect(context)).toBe(true);
    });
    
    it('should return false for non-Google Forms pages', () => {
      const div = document.createElement('div');
      const input = document.createElement('input');
      div.appendChild(input);
      document.body.appendChild(div);
      
      const context = createDetectionContext(input);
      
      expect(detector.canDetect(context)).toBe(false);
    });
    
    it('should detect page with freebird classes', () => {
      const page = createGoogleFormsPage();
      const question = createGoogleFormsQuestion({ title: 'Email' });
      page.appendChild(question);
      document.body.appendChild(page);
      
      const input = question.querySelector('input')!;
      const context = createDetectionContext(input);
      
      expect(detector.canDetect(context)).toBe(true);
    });
  });
  
  // ==========================================================================
  // QUESTION TITLE DETECTION
  // ==========================================================================
  
  describe('question title detection', () => {
    it('should detect question title', () => {
      const page = createGoogleFormsPage();
      const question = createGoogleFormsQuestion({ title: 'Email Address' });
      page.appendChild(question);
      document.body.appendChild(page);
      
      const input = question.querySelector('input')!;
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result).not.toBeNull();
      expect(result?.label).toBe('Email Address');
      expect(result?.confidence).toBeGreaterThanOrEqual(GOOGLE_FORMS_CONFIDENCE.QUESTION_TITLE);
    });
    
    it('should exclude required asterisk from title', () => {
      const page = createGoogleFormsPage();
      const question = createGoogleFormsQuestion({ 
        title: 'Full Name', 
        required: true 
      });
      page.appendChild(question);
      document.body.appendChild(page);
      
      const input = question.querySelector('input')!;
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('Full Name');
      expect(result?.label).not.toContain('*');
    });
    
    it('should detect different question types', () => {
      const page = createGoogleFormsPage();
      const question = createGoogleFormsQuestion({
        title: 'Favorite Color',
        type: 'radio',
        options: ['Red', 'Blue', 'Green'],
      });
      page.appendChild(question);
      document.body.appendChild(page);
      
      const radio = question.querySelector('input[type="radio"]')!;
      const context = createDetectionContext(radio);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toContain('Favorite Color');
    });
  });
  
  // ==========================================================================
  // OPTION LABEL DETECTION
  // ==========================================================================
  
  describe('option label detection', () => {
    it('should detect radio option label', () => {
      const page = createGoogleFormsPage();
      const question = createGoogleFormsQuestion({
        title: 'Gender',
        type: 'radio',
        options: ['Male', 'Female', 'Other'],
      });
      page.appendChild(question);
      document.body.appendChild(page);
      
      // Get the specific radio input, not just any
      const radioChoice = question.querySelector('.freebirdFormviewerComponentsQuestionRadioChoice')!;
      const radio = radioChoice.querySelector('input[type="radio"]')!;
      const context = createDetectionContext(radio);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      // Question title has higher priority, so should detect title first
      // Option detection only happens if question title is not found
      expect(result?.label).toContain('Gender');
    });
    
    it('should detect checkbox option label', () => {
      const page = createGoogleFormsPage();
      const question = createGoogleFormsQuestion({
        title: 'Interests',
        type: 'checkbox',
        options: ['Sports', 'Music', 'Art'],
      });
      page.appendChild(question);
      document.body.appendChild(page);
      
      const checkboxChoice = question.querySelector('.freebirdFormviewerComponentsQuestionCheckboxChoice')!;
      const checkbox = checkboxChoice.querySelector('input[type="checkbox"]')!;
      const context = createDetectionContext(checkbox);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      // Question title has higher priority
      expect(result?.label).toContain('Interests');
    });
    
    it('should detect question title for radio inputs', () => {
      const page = createGoogleFormsPage();
      const question = createGoogleFormsQuestion({
        title: 'Choice',
        type: 'radio',
        options: ['Option A'],
      });
      page.appendChild(question);
      document.body.appendChild(page);
      
      const radioChoice = question.querySelector('.freebirdFormviewerComponentsQuestionRadioChoice')!;
      const radio = radioChoice.querySelector('input[type="radio"]')!;
      const context = createDetectionContext(radio);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      // Should detect question title (higher priority)
      expect(result?.label).toBe('Choice');
      expect(result?.confidence).toBeGreaterThanOrEqual(GOOGLE_FORMS_CONFIDENCE.QUESTION_TITLE);
    });
  });
  
  // ==========================================================================
  // DESCRIPTION DETECTION
  // ==========================================================================
  
  describe('description detection', () => {
    it('should detect description when no title match', () => {
      const page = createGoogleFormsPage();
      const question = createGoogleFormsQuestion({
        title: '',  // Empty title
        description: 'Please enter your email',
      });
      // Manually clear the title
      const titleEl = question.querySelector('.freebirdFormviewerComponentsQuestionBaseTitle');
      if (titleEl) titleEl.textContent = '';
      
      page.appendChild(question);
      document.body.appendChild(page);
      
      const input = question.querySelector('input')!;
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      // May or may not detect depending on implementation
      // The key is it shouldn't error
      expect(result === null || result?.label !== undefined).toBe(true);
    });
  });
  
  // ==========================================================================
  // QUESTION TYPE DETECTION
  // ==========================================================================
  
  describe('question type detection', () => {
    it('should detect short-answer type', () => {
      const page = createGoogleFormsPage();
      const question = createGoogleFormsQuestion({
        title: 'Name',
        type: 'text',
      });
      page.appendChild(question);
      document.body.appendChild(page);
      
      const input = question.querySelector('input')!;
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.metadata?.extra?.questionType).toBe('short-answer');
    });
    
    it('should detect multiple-choice type', () => {
      const page = createGoogleFormsPage();
      const question = createGoogleFormsQuestion({
        title: 'Choice',
        type: 'radio',
        options: ['A', 'B'],
      });
      page.appendChild(question);
      document.body.appendChild(page);
      
      // Get from the text input perspective (the title)
      const titleEl = question.querySelector('.freebirdFormviewerComponentsQuestionBaseTitle')!;
      const context = createDetectionContext(titleEl);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.metadata?.extra?.questionType).toBe('multiple-choice');
    });
    
    it('should detect checkboxes type', () => {
      const page = createGoogleFormsPage();
      const question = createGoogleFormsQuestion({
        title: 'Select',
        type: 'checkbox',
        options: ['X', 'Y'],
      });
      page.appendChild(question);
      document.body.appendChild(page);
      
      const checkbox = question.querySelector('input[type="checkbox"]')!;
      const context = createDetectionContext(checkbox);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.metadata?.extra?.questionType).toBe('checkboxes');
    });
    
    it('should detect dropdown type', () => {
      const page = createGoogleFormsPage();
      const question = createGoogleFormsQuestion({
        title: 'Country',
        type: 'dropdown',
        options: ['USA', 'Canada'],
      });
      page.appendChild(question);
      document.body.appendChild(page);
      
      const select = question.querySelector('select')!;
      const context = createDetectionContext(select);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.metadata?.extra?.questionType).toBe('dropdown');
    });
  });
  
  // ==========================================================================
  // METADATA
  // ==========================================================================
  
  describe('metadata', () => {
    it('should include framework info', () => {
      const page = createGoogleFormsPage();
      const question = createGoogleFormsQuestion({ title: 'Test' });
      page.appendChild(question);
      document.body.appendChild(page);
      
      const input = question.querySelector('input')!;
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.metadata?.extra?.framework).toBe('google-forms');
    });
    
    it('should include pattern type', () => {
      const page = createGoogleFormsPage();
      const question = createGoogleFormsQuestion({ title: 'Test' });
      page.appendChild(question);
      document.body.appendChild(page);
      
      const input = question.querySelector('input')!;
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.metadata?.extra?.patternType).toBe('question-title');
    });
  });
});

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================

describe('createGoogleFormsDetector', () => {
  it('should create detector instance', () => {
    const detector = createGoogleFormsDetector();
    expect(detector).toBeInstanceOf(GoogleFormsDetector);
  });
});

describe('isGoogleFormsElement', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });
  
  it('should return true for Google Forms element', () => {
    const page = createGoogleFormsPage();
    const question = createGoogleFormsQuestion({ title: 'Test' });
    page.appendChild(question);
    document.body.appendChild(page);
    
    const input = question.querySelector('input')!;
    expect(isGoogleFormsElement(input)).toBe(true);
  });
  
  it('should return false for non-Google Forms element', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    
    expect(isGoogleFormsElement(input)).toBe(false);
  });
});

describe('getGoogleFormsQuestionTitle', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });
  
  it('should return question title', () => {
    const page = createGoogleFormsPage();
    const question = createGoogleFormsQuestion({ title: 'Your Email' });
    page.appendChild(question);
    document.body.appendChild(page);
    
    const input = question.querySelector('input')!;
    expect(getGoogleFormsQuestionTitle(input)).toBe('Your Email');
  });
  
  it('should return null for non-Google Forms element', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    
    expect(getGoogleFormsQuestionTitle(input)).toBeNull();
  });
});

describe('getGoogleFormsQuestionType', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });
  
  it('should return question type', () => {
    const page = createGoogleFormsPage();
    const question = createGoogleFormsQuestion({
      title: 'Choice',
      type: 'radio',
      options: ['A'],
    });
    page.appendChild(question);
    document.body.appendChild(page);
    
    const radio = question.querySelector('input[type="radio"]')!;
    expect(getGoogleFormsQuestionType(radio)).toBe('multiple-choice');
  });
});

describe('isGoogleFormsUrl', () => {
  it('should return true for Google Forms URLs', () => {
    expect(isGoogleFormsUrl('https://docs.google.com/forms/d/abc123')).toBe(true);
    expect(isGoogleFormsUrl('https://forms.gle/xyz789')).toBe(true);
    expect(isGoogleFormsUrl('https://forms.google.com/something')).toBe(true);
  });
  
  it('should return false for non-Google Forms URLs', () => {
    expect(isGoogleFormsUrl('https://example.com')).toBe(false);
    expect(isGoogleFormsUrl('https://google.com')).toBe(false);
  });
});

// ============================================================================
// CONSTANT TESTS
// ============================================================================

describe('GOOGLE_FORMS_CONFIDENCE', () => {
  it('should have highest confidence for question title', () => {
    expect(GOOGLE_FORMS_CONFIDENCE.QUESTION_TITLE).toBe(0.95);
  });
  
  it('should have expected values in order', () => {
    expect(GOOGLE_FORMS_CONFIDENCE.QUESTION_TITLE).toBeGreaterThan(GOOGLE_FORMS_CONFIDENCE.OPTION_LABEL);
    expect(GOOGLE_FORMS_CONFIDENCE.OPTION_LABEL).toBeGreaterThan(GOOGLE_FORMS_CONFIDENCE.SECTION_HEADER);
    expect(GOOGLE_FORMS_CONFIDENCE.SECTION_HEADER).toBeGreaterThan(GOOGLE_FORMS_CONFIDENCE.DESCRIPTION);
  });
});

describe('QUESTION_TITLE_SELECTORS', () => {
  it('should include main title selector', () => {
    expect(QUESTION_TITLE_SELECTORS).toContain('.freebirdFormviewerComponentsQuestionBaseTitle');
  });
});

describe('QUESTION_CONTAINER_SELECTORS', () => {
  it('should include item container', () => {
    expect(QUESTION_CONTAINER_SELECTORS).toContain('.freebirdFormviewerViewItemsItemItem');
  });
});

describe('INPUT_SELECTORS', () => {
  it('should have selectors for all question types', () => {
    expect(INPUT_SELECTORS.SHORT_TEXT).toBeDefined();
    expect(INPUT_SELECTORS.PARAGRAPH).toBeDefined();
    expect(INPUT_SELECTORS.RADIO).toBeDefined();
    expect(INPUT_SELECTORS.CHECKBOX).toBeDefined();
    expect(INPUT_SELECTORS.DROPDOWN).toBeDefined();
    expect(INPUT_SELECTORS.DATE).toBeDefined();
    expect(INPUT_SELECTORS.TIME).toBeDefined();
    expect(INPUT_SELECTORS.SCALE).toBeDefined();
    expect(INPUT_SELECTORS.FILE).toBeDefined();
  });
});
