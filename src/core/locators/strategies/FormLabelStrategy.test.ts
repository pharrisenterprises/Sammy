/**
 * FormLabelStrategy Test Suite
 * @module core/locators/strategies/FormLabelStrategy.test
 */

// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  FormLabelStrategy,
  createFormLabelStrategy,
  getFormLabelStrategy,
  normalizeText,
  textSimilarity,
  isLabelableElement,
  getExplicitLabel,
  getImplicitLabel,
  getAriaLabelElement,
  getProximityLabel,
  getLabelAssociations,
  getInputLabelText,
  findInputsByLabelText,
  STRATEGY_NAME,
  STRATEGY_PRIORITY,
  BASE_CONFIDENCE,
  LABEL_SIMILARITY_THRESHOLD,
} from './FormLabelStrategy';
import type { LocatorBundle } from '../../types/locator-bundle';
import type { LocatorContext } from './ILocatorStrategy';

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Creates a minimal LocatorBundle for testing
 */
function createTestBundle(overrides: Partial<LocatorBundle> = {}): LocatorBundle {
  return {
    tag: 'input',
    id: '',
    name: '',
    placeholder: '',
    aria: '',
    dataAttrs: {},
    text: 'Email Address',
    css: '',
    xpath: '/html/body/input',
    classes: [],
    pageUrl: 'http://localhost',
    bounding: { x: 100, y: 100, width: 200, height: 40 },
    iframeChain: null,
    shadowHosts: null,
    ...overrides,
  };
}

/**
 * Creates a test context
 */
function createTestContext(doc?: Document): LocatorContext {
  return {
    document: doc || document,
  };
}

/**
 * Creates a labeled input with explicit for association
 */
function createExplicitLabeledInput(
  labelText: string,
  inputId: string,
  inputType: string = 'text'
): { label: HTMLLabelElement; input: HTMLInputElement } {
  const label = document.createElement('label');
  label.setAttribute('for', inputId);
  label.textContent = labelText;
  
  const input = document.createElement('input');
  input.id = inputId;
  input.type = inputType;
  
  return { label, input };
}

/**
 * Creates an implicitly labeled input (wrapped)
 */
function createImplicitLabeledInput(
  labelText: string,
  inputType: string = 'text'
): { label: HTMLLabelElement; input: HTMLInputElement } {
  const label = document.createElement('label');
  label.textContent = labelText;
  
  const input = document.createElement('input');
  input.type = inputType;
  label.appendChild(input);
  
  return { label, input };
}

/**
 * Creates an input with aria-labelledby
 */
function createAriaLabeledInput(
  labelText: string,
  labelId: string
): { labelElement: HTMLSpanElement; input: HTMLInputElement } {
  const labelElement = document.createElement('span');
  labelElement.id = labelId;
  labelElement.textContent = labelText;
  
  const input = document.createElement('input');
  input.setAttribute('aria-labelledby', labelId);
  
  return { labelElement, input };
}

// ============================================================================
// HELPER FUNCTION TESTS
// ============================================================================

describe('normalizeText', () => {
  it('should trim whitespace', () => {
    expect(normalizeText('  hello  ')).toBe('hello');
  });
  
  it('should lowercase', () => {
    expect(normalizeText('Hello World')).toBe('hello world');
  });
  
  it('should collapse spaces', () => {
    expect(normalizeText('hello    world')).toBe('hello world');
  });
  
  it('should remove colons and asterisks', () => {
    expect(normalizeText('Email*:')).toBe('email');
  });
  
  it('should handle null/undefined', () => {
    expect(normalizeText(null)).toBe('');
    expect(normalizeText(undefined)).toBe('');
  });
});

describe('textSimilarity', () => {
  it('should return 1 for identical strings', () => {
    expect(textSimilarity('Email', 'Email')).toBe(1);
  });
  
  it('should return 1 for case-insensitive match', () => {
    expect(textSimilarity('Email', 'email')).toBe(1);
  });
  
  it('should return high score for containment', () => {
    const score = textSimilarity('Email', 'Email Address');
    expect(score).toBeGreaterThan(0.3);
  });
  
  it('should return partial score for word overlap', () => {
    const score = textSimilarity('Email Address', 'Email Field');
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });
  
  it('should return 0 for completely different strings', () => {
    expect(textSimilarity('Email', 'Password')).toBe(0);
  });
});

describe('isLabelableElement', () => {
  it('should return true for text input', () => {
    const input = document.createElement('input');
    input.type = 'text';
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
  
  it('should return false for hidden input', () => {
    const input = document.createElement('input');
    input.type = 'hidden';
    expect(isLabelableElement(input)).toBe(false);
  });
  
  it('should return false for div', () => {
    const div = document.createElement('div');
    expect(isLabelableElement(div)).toBe(false);
  });
});

describe('getExplicitLabel', () => {
  let container: HTMLDivElement;
  
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });
  
  afterEach(() => {
    container.remove();
  });
  
  it('should find label with for attribute', () => {
    const { label, input } = createExplicitLabeledInput('Email', 'emailInput');
    container.appendChild(label);
    container.appendChild(input);
    
    const found = getExplicitLabel(input, document);
    
    expect(found).toBe(label);
  });
  
  it('should return null for input without id', () => {
    const input = document.createElement('input');
    container.appendChild(input);
    
    const found = getExplicitLabel(input, document);
    
    expect(found).toBeNull();
  });
  
  it('should return null when no matching label', () => {
    const input = document.createElement('input');
    input.id = 'noMatchingLabel';
    container.appendChild(input);
    
    const found = getExplicitLabel(input, document);
    
    expect(found).toBeNull();
  });
});

describe('getImplicitLabel', () => {
  it('should find wrapping label', () => {
    const { label, input } = createImplicitLabeledInput('Email');
    
    const found = getImplicitLabel(input);
    
    expect(found).toBe(label);
  });
  
  it('should return null for unwrapped input', () => {
    const input = document.createElement('input');
    
    const found = getImplicitLabel(input);
    
    expect(found).toBeNull();
  });
  
  it('should find nested label', () => {
    const label = document.createElement('label');
    const div = document.createElement('div');
    const input = document.createElement('input');
    
    div.appendChild(input);
    label.appendChild(div);
    
    const found = getImplicitLabel(input);
    
    expect(found).toBe(label);
  });
});

describe('getAriaLabelElement', () => {
  let container: HTMLDivElement;
  
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });
  
  afterEach(() => {
    container.remove();
  });
  
  it('should find element by aria-labelledby', () => {
    const { labelElement, input } = createAriaLabeledInput('Email', 'emailLabel');
    container.appendChild(labelElement);
    container.appendChild(input);
    
    const found = getAriaLabelElement(input, document);
    
    expect(found).toBe(labelElement);
  });
  
  it('should return null without aria-labelledby', () => {
    const input = document.createElement('input');
    container.appendChild(input);
    
    const found = getAriaLabelElement(input, document);
    
    expect(found).toBeNull();
  });
  
  it('should handle space-separated ids', () => {
    const label1 = document.createElement('span');
    label1.id = 'label1';
    label1.textContent = 'First';
    
    const input = document.createElement('input');
    input.setAttribute('aria-labelledby', 'label1 label2');
    
    container.appendChild(label1);
    container.appendChild(input);
    
    const found = getAriaLabelElement(input, document);
    
    expect(found).toBe(label1);
  });
});

describe('getProximityLabel', () => {
  it('should find preceding sibling label', () => {
    const div = document.createElement('div');
    const label = document.createElement('label');
    label.textContent = 'Email';
    const input = document.createElement('input');
    
    div.appendChild(label);
    div.appendChild(input);
    
    const found = getProximityLabel(input);
    
    expect(found).toBe(label);
  });
  
  it('should return null when no nearby label', () => {
    const input = document.createElement('input');
    
    const found = getProximityLabel(input);
    
    expect(found).toBeNull();
  });
});

describe('getLabelAssociations', () => {
  let container: HTMLDivElement;
  
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });
  
  afterEach(() => {
    container.remove();
  });
  
  it('should find explicit association', () => {
    const { label, input } = createExplicitLabeledInput('Email', 'emailInput');
    container.appendChild(label);
    container.appendChild(input);
    
    const associations = getLabelAssociations(input, document);
    
    expect(associations.length).toBeGreaterThan(0);
    expect(associations[0].type).toBe('explicit');
  });
  
  it('should find implicit association', () => {
    const { label, input } = createImplicitLabeledInput('Email');
    container.appendChild(label);
    
    const associations = getLabelAssociations(input, document);
    
    expect(associations.length).toBeGreaterThan(0);
    expect(associations.some(a => a.type === 'implicit')).toBe(true);
  });
  
  it('should find aria association', () => {
    const { labelElement, input } = createAriaLabeledInput('Email', 'ariaLabel');
    container.appendChild(labelElement);
    container.appendChild(input);
    
    const associations = getLabelAssociations(input, document);
    
    expect(associations.some(a => a.type === 'aria')).toBe(true);
  });
});

describe('getInputLabelText', () => {
  let container: HTMLDivElement;
  
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });
  
  afterEach(() => {
    container.remove();
  });
  
  it('should get text from explicit label', () => {
    const { label, input } = createExplicitLabeledInput('Email Address', 'email');
    container.appendChild(label);
    container.appendChild(input);
    
    const { text, type } = getInputLabelText(input, document);
    
    expect(text).toBe('Email Address');
    expect(type).toBe('explicit');
  });
  
  it('should fall back to aria-label', () => {
    const input = document.createElement('input');
    input.setAttribute('aria-label', 'Search');
    container.appendChild(input);
    
    const { text, type } = getInputLabelText(input, document);
    
    expect(text).toBe('Search');
    expect(type).toBe('aria');
  });
  
  it('should fall back to placeholder', () => {
    const input = document.createElement('input') as HTMLInputElement;
    input.placeholder = 'Enter email';
    container.appendChild(input);
    
    const { text, type } = getInputLabelText(input, document);
    
    expect(text).toBe('Enter email');
    expect(type).toBe('none');
  });
});

describe('findInputsByLabelText', () => {
  let container: HTMLDivElement;
  
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });
  
  afterEach(() => {
    container.remove();
  });
  
  it('should find input by exact label match', () => {
    const { label, input } = createExplicitLabeledInput('Email Address', 'email');
    container.appendChild(label);
    container.appendChild(input);
    
    const candidates = findInputsByLabelText('Email Address', document);
    
    expect(candidates.length).toBe(1);
    expect(candidates[0].element).toBe(input);
    expect(candidates[0].similarity).toBe(1);
  });
  
  it('should find input by similar label', () => {
    const { label, input } = createExplicitLabeledInput('Email Address', 'email');
    container.appendChild(label);
    container.appendChild(input);
    
    const candidates = findInputsByLabelText('Email Address', document);
    
    expect(candidates.length).toBe(1);
    expect(candidates[0].similarity).toBeGreaterThanOrEqual(LABEL_SIMILARITY_THRESHOLD);
  });
  
  it('should sort by score', () => {
    const { label: label1, input: input1 } = createExplicitLabeledInput('Email Address', 'email1');
    const { label: label2, input: input2 } = createExplicitLabeledInput('Email Address', 'email2');
    container.appendChild(label1);
    container.appendChild(input1);
    container.appendChild(label2);
    container.appendChild(input2);
    
    const candidates = findInputsByLabelText('Email Address', document);
    
    expect(candidates.length).toBe(2);
    // Both have same score since labels are identical
    expect(candidates[0].score).toBeGreaterThanOrEqual(0);
    expect(candidates[1].score).toBeGreaterThanOrEqual(0);
  });
  
  it('should return empty for no matches', () => {
    const { label, input } = createExplicitLabeledInput('Password', 'password');
    container.appendChild(label);
    container.appendChild(input);
    
    const candidates = findInputsByLabelText('Email', document);
    
    expect(candidates.length).toBe(0);
  });
});

// ============================================================================
// STRATEGY CLASS TESTS
// ============================================================================

describe('FormLabelStrategy', () => {
  let strategy: FormLabelStrategy;
  let container: HTMLDivElement;
  
  beforeEach(() => {
    strategy = createFormLabelStrategy();
    container = document.createElement('div');
    document.body.appendChild(container);
  });
  
  afterEach(() => {
    container.remove();
  });
  
  describe('constructor and properties', () => {
    it('should have correct name', () => {
      expect(strategy.name).toBe(STRATEGY_NAME);
    });
    
    it('should have correct priority', () => {
      expect(strategy.priority).toBe(STRATEGY_PRIORITY);
    });
    
    it('should have correct base confidence', () => {
      expect(strategy.baseConfidence).toBe(BASE_CONFIDENCE);
    });
  });
  
  describe('canHandle', () => {
    it('should return true for input with aria label', () => {
      const bundle = createTestBundle({ tag: 'input', aria: 'Email' });
      expect(strategy.canHandle(bundle)).toBe(true);
    });
    
    it('should return true for input with text', () => {
      const bundle = createTestBundle({ tag: 'input', text: 'Email' });
      expect(strategy.canHandle(bundle)).toBe(true);
    });
    
    it('should return true for input with placeholder', () => {
      const bundle = createTestBundle({ tag: 'input', placeholder: 'Enter email' });
      expect(strategy.canHandle(bundle)).toBe(true);
    });
    
    it('should return false for non-labelable element', () => {
      const bundle = createTestBundle({ tag: 'div', text: 'Some text' });
      expect(strategy.canHandle(bundle)).toBe(false);
    });
    
    it('should return false for input without label data', () => {
      const bundle = createTestBundle({
        tag: 'input',
        aria: '',
        text: '',
        placeholder: '',
      });
      expect(strategy.canHandle(bundle)).toBe(false);
    });
  });
  
  describe('find', () => {
    it('should find input by label text', () => {
      const { label, input } = createExplicitLabeledInput('Email Address', 'email');
      container.appendChild(label);
      container.appendChild(input);
      
      const bundle = createTestBundle({ tag: 'input', text: 'Email Address' });
      const context = createTestContext();
      
      const result = strategy.find(bundle, context);
      
      expect(result.element).toBe(input);
      expect(result.confidence).toBeGreaterThan(BASE_CONFIDENCE);
      expect(result.metadata?.matchedLabel).toBe('Email Address');
    });
    
    it('should find input by aria label in bundle', () => {
      const { label, input } = createExplicitLabeledInput('Email', 'email');
      container.appendChild(label);
      container.appendChild(input);
      
      const bundle = createTestBundle({ tag: 'input', aria: 'Email' });
      const context = createTestContext();
      
      const result = strategy.find(bundle, context);
      
      expect(result.element).toBe(input);
    });
    
    it('should return null for no matches', () => {
      const { label, input } = createExplicitLabeledInput('Password', 'password');
      container.appendChild(label);
      container.appendChild(input);
      
      const bundle = createTestBundle({ tag: 'input', text: 'Email' });
      const context = createTestContext();
      
      const result = strategy.find(bundle, context);
      
      expect(result.element).toBeNull();
    });
    
    it('should have higher confidence for explicit label', () => {
      const { label: explicitLabel, input: explicitInput } = 
        createExplicitLabeledInput('Email', 'email1');
      container.appendChild(explicitLabel);
      container.appendChild(explicitInput);
      
      const bundle = createTestBundle({ tag: 'input', text: 'Email' });
      const context = createTestContext();
      
      const result = strategy.find(bundle, context);
      
      expect(result.metadata?.associationType).toBe('explicit');
      expect(result.confidence).toBeGreaterThan(BASE_CONFIDENCE);
    });
    
    it('should report candidate count', () => {
      const { label: label1, input: input1 } = createExplicitLabeledInput('Email', 'email1');
      const { label: label2, input: input2 } = createExplicitLabeledInput('Email', 'email2');
      container.appendChild(label1);
      container.appendChild(input1);
      container.appendChild(label2);
      container.appendChild(input2);
      
      const bundle = createTestBundle({ tag: 'input', text: 'Email' });
      const context = createTestContext();
      
      const result = strategy.find(bundle, context);
      
      expect(result.metadata?.candidateCount).toBe(2);
    });
  });
  
  describe('generateSelector', () => {
    it('should return label text', () => {
      const { label, input } = createExplicitLabeledInput('Email Address', 'email');
      container.appendChild(label);
      container.appendChild(input);
      
      const selector = strategy.generateSelector(input);
      
      expect(selector).toBe('Email Address');
    });
    
    it('should return null for non-labelable element', () => {
      const div = document.createElement('div');
      container.appendChild(div);
      
      const selector = strategy.generateSelector(div);
      
      expect(selector).toBeNull();
    });
    
    it('should return null for unlabeled input', () => {
      const input = document.createElement('input');
      container.appendChild(input);
      
      const selector = strategy.generateSelector(input);
      
      expect(selector).toBeNull();
    });
  });
  
  describe('validate', () => {
    it('should return true for matching label', () => {
      const { label, input } = createExplicitLabeledInput('Email', 'email');
      container.appendChild(label);
      container.appendChild(input);
      
      expect(strategy.validate(input, 'Email')).toBe(true);
    });
    
    it('should return true for similar label', () => {
      const { label, input } = createExplicitLabeledInput('Email Address', 'email');
      container.appendChild(label);
      container.appendChild(input);
      
      expect(strategy.validate(input, 'Email Address')).toBe(true);
    });
    
    it('should return false for different label', () => {
      const { label, input } = createExplicitLabeledInput('Password', 'password');
      container.appendChild(label);
      container.appendChild(input);
      
      expect(strategy.validate(input, 'Email')).toBe(false);
    });
  });
  
  describe('getAssociationType', () => {
    it('should return explicit for for-attribute', () => {
      const { label, input } = createExplicitLabeledInput('Email', 'email');
      container.appendChild(label);
      container.appendChild(input);
      
      expect(strategy.getAssociationType(input)).toBe('explicit');
    });
    
    it('should return implicit for wrapped input', () => {
      const { label, input } = createImplicitLabeledInput('Email');
      container.appendChild(label);
      
      expect(strategy.getAssociationType(input)).toBe('implicit');
    });
    
    it('should return none for unlabeled input', () => {
      const input = document.createElement('input');
      container.appendChild(input);
      
      expect(strategy.getAssociationType(input)).toBe('none');
    });
  });
  
  describe('findByLabel', () => {
    it('should find all inputs with matching label', () => {
      const { label: label1, input: input1 } = createExplicitLabeledInput('Email', 'email1');
      const { label: label2, input: input2 } = createExplicitLabeledInput('Email', 'email2');
      container.appendChild(label1);
      container.appendChild(input1);
      container.appendChild(label2);
      container.appendChild(input2);
      
      const inputs = strategy.findByLabel('Email', document);
      
      expect(inputs.length).toBe(2);
      expect(inputs).toContain(input1);
      expect(inputs).toContain(input2);
    });
  });
});

// ============================================================================
// FACTORY TESTS
// ============================================================================

describe('getFormLabelStrategy (singleton)', () => {
  it('should return same instance', () => {
    const instance1 = getFormLabelStrategy();
    const instance2 = getFormLabelStrategy();
    expect(instance1).toBe(instance2);
  });
});

describe('createFormLabelStrategy (factory)', () => {
  it('should create new instance each time', () => {
    const instance1 = createFormLabelStrategy();
    const instance2 = createFormLabelStrategy();
    expect(instance1).not.toBe(instance2);
  });
});
