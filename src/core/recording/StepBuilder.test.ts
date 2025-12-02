/**
 * Tests for StepBuilder
 * @module core/recording/StepBuilder.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  StepBuilder,
  createStepBuilder,
  createLightweightBuilder,
  getStepBuilder,
  resetStepBuilder,
  buildClickStep,
  buildInputStep,
  buildNavigationStep,
  createLocatorBundle,
  DEFAULT_STEP_BUILDER_CONFIG,
  type Step,
  type LocatorBundle,
  type StepEventType,
} from './StepBuilder';

import { LabelDetectorRegistry } from './labels/LabelDetectorRegistry';
import { LabelResolver } from './labels/LabelResolver';

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Create a test input element
 */
function createTestInput(attrs: Record<string, string> = {}): HTMLInputElement {
  const input = document.createElement('input');
  input.type = attrs.type || 'text';
  input.id = attrs.id || 'test-input';
  input.name = attrs.name || 'testInput';
  input.placeholder = attrs.placeholder || 'Enter text';
  
  if (attrs.value) {
    input.value = attrs.value;
  }
  
  for (const [key, value] of Object.entries(attrs)) {
    if (key.startsWith('data-')) {
      input.setAttribute(key, value);
    }
  }
  
  document.body.appendChild(input);
  return input;
}

/**
 * Create a test button element
 */
function createTestButton(text: string = 'Submit'): HTMLButtonElement {
  const button = document.createElement('button');
  button.textContent = text;
  button.id = 'test-button';
  document.body.appendChild(button);
  return button;
}

/**
 * Create a test link element
 */
function createTestLink(text: string = 'Click here', href: string = '#'): HTMLAnchorElement {
  const link = document.createElement('a');
  link.textContent = text;
  link.href = href;
  link.id = 'test-link';
  document.body.appendChild(link);
  return link;
}

/**
 * Create a mock click event
 */
function createClickEvent(): MouseEvent {
  return new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    clientX: 100,
    clientY: 200,
  });
}

/**
 * Create a mock input event
 */
function createInputEvent(): InputEvent {
  return new InputEvent('input', {
    bubbles: true,
    cancelable: true,
    data: 'test',
  });
}

// ============================================================================
// TESTS
// ============================================================================

describe('StepBuilder', () => {
  let builder: StepBuilder;
  
  beforeEach(() => {
    LabelDetectorRegistry.resetInstance();
    resetStepBuilder();
    builder = new StepBuilder();
  });
  
  afterEach(() => {
    document.body.innerHTML = '';
    LabelDetectorRegistry.resetInstance();
    resetStepBuilder();
  });
  
  // ==========================================================================
  // BASIC BUILDING
  // ==========================================================================
  
  describe('basic building', () => {
    it('should build step from click', () => {
      const button = createTestButton('Submit');
      const step = builder.buildFromClick(button);
      
      expect(step.id).toBeDefined();
      expect(step.event).toBe('click');
      expect(step.path).toContain('button');
    });
    
    it('should build step from input', () => {
      const input = createTestInput({ value: 'test@example.com' });
      const step = builder.buildFromInput(input, undefined, 'test@example.com');
      
      expect(step.event).toBe('input');
      expect(step.value).toBe('test@example.com');
    });
    
    it('should build step from keyboard enter', () => {
      const input = createTestInput();
      const step = builder.buildFromKeyboard(input);
      
      expect(step.event).toBe('enter');
    });
    
    it('should build navigation step', () => {
      const step = builder.buildFromNavigation('https://example.com/page');
      
      expect(step.event).toBe('open');
      expect(step.value).toBe('https://example.com/page');
      expect(step.name).toContain('Navigate');
    });
  });
  
  // ==========================================================================
  // ID GENERATION
  // ==========================================================================
  
  describe('id generation', () => {
    it('should generate unique IDs', () => {
      const button = createTestButton();
      const step1 = builder.buildFromClick(button);
      const step2 = builder.buildFromClick(button);
      
      expect(step1.id).not.toBe(step2.id);
    });
    
    it('should include sequence number in ID', () => {
      const button = createTestButton();
      const step = builder.buildFromClick(button);
      
      expect(step.id).toContain('_1_');
    });
    
    it('should increment sequence', () => {
      const button = createTestButton();
      
      expect(builder.getSequence()).toBe(1);
      builder.buildFromClick(button);
      expect(builder.getSequence()).toBe(2);
      builder.buildFromClick(button);
      expect(builder.getSequence()).toBe(3);
    });
    
    it('should reset sequence', () => {
      const button = createTestButton();
      builder.buildFromClick(button);
      builder.buildFromClick(button);
      
      builder.resetSequence();
      
      expect(builder.getSequence()).toBe(1);
    });
  });
  
  // ==========================================================================
  // LABEL DETECTION
  // ==========================================================================
  
  describe('label detection', () => {
    it('should resolve label from placeholder', () => {
      const input = createTestInput({ placeholder: 'Email Address' });
      const step = builder.buildFromInput(input);
      
      // Label resolution depends on enabled detectors
      expect(step.label).toBeDefined();
    });
    
    it('should use default label when resolution fails', () => {
      // Create element with no label hints
      const div = document.createElement('div');
      document.body.appendChild(div);
      
      const step = builder.build({ element: div, eventType: 'click' });
      
      expect(step.label).toBe(DEFAULT_STEP_BUILDER_CONFIG.defaultLabel);
    });
    
    it('should accept label override', () => {
      const button = createTestButton();
      const step = builder.build({
        element: button,
        eventType: 'click',
        labelOverride: 'Custom Label',
      });
      
      expect(step.label).toBe('Custom Label');
    });
  });
  
  // ==========================================================================
  // NAME GENERATION
  // ==========================================================================
  
  describe('name generation', () => {
    it('should generate name with click verb', () => {
      const button = createTestButton('Submit');
      const step = builder.buildFromClick(button);
      
      expect(step.name).toContain('Click');
    });
    
    it('should generate name with input verb', () => {
      const input = createTestInput();
      const step = builder.buildFromInput(input, undefined, 'test');
      
      expect(step.name).toContain('Type in');
    });
    
    it('should generate name with enter verb', () => {
      const input = createTestInput();
      const step = builder.buildFromKeyboard(input);
      
      expect(step.name).toContain('Press Enter');
    });
  });
  
  // ==========================================================================
  // XPATH GENERATION
  // ==========================================================================
  
  describe('xpath generation', () => {
    it('should generate valid XPath', () => {
      const input = createTestInput();
      const xpath = builder.generateXPath(input);
      
      expect(xpath).toMatch(/^\/html\/body/);
      expect(xpath).toContain('input');
    });
    
    it('should include index for multiple siblings', () => {
      const container = document.createElement('div');
      const input1 = document.createElement('input');
      const input2 = document.createElement('input');
      container.appendChild(input1);
      container.appendChild(input2);
      document.body.appendChild(container);
      
      const xpath1 = builder.generateXPath(input1);
      const xpath2 = builder.generateXPath(input2);
      
      expect(xpath1).toContain('input[1]');
      expect(xpath2).toContain('input[2]');
    });
  });
  
  // ==========================================================================
  // CSS SELECTOR GENERATION
  // ==========================================================================
  
  describe('css selector generation', () => {
    it('should prefer ID selector', () => {
      const input = createTestInput({ id: 'email-input' });
      const css = builder.generateCssSelector(input);
      
      expect(css).toBe('input#email-input');
    });
    
    it('should use name attribute when no ID', () => {
      const input = document.createElement('input');
      input.name = 'email';
      document.body.appendChild(input);
      
      const css = builder.generateCssSelector(input);
      
      expect(css).toBe('input[name="email"]');
    });
    
    it('should use classes as fallback', () => {
      const div = document.createElement('div');
      div.className = 'container main';
      document.body.appendChild(div);
      
      const css = builder.generateCssSelector(div);
      
      expect(css).toBe('div.container.main');
    });
  });
  
  // ==========================================================================
  // BUNDLE CREATION
  // ==========================================================================
  
  describe('bundle creation', () => {
    it('should create complete bundle', () => {
      const input = createTestInput({
        id: 'test-id',
        name: 'testName',
        placeholder: 'Enter value',
        'data-testid': 'test-element',
      });
      input.setAttribute('aria-label', 'Test Input');
      
      const bundle = builder.createBundle(input);
      
      expect(bundle.tag).toBe('input');
      expect(bundle.id).toBe('test-id');
      expect(bundle.name).toBe('testName');
      expect(bundle.placeholder).toBe('Enter value');
      expect(bundle.aria).toBe('Test Input');
      expect(bundle.dataAttrs.testid).toBe('test-element');
      expect(bundle.xpath).toContain('input');
      expect(bundle.css).toContain('test-id');
    });
    
    it('should include bounding info', () => {
      const button = createTestButton();
      const bundle = builder.createBundle(button);
      
      expect(bundle.bounding).toBeDefined();
      expect(typeof bundle.bounding.x).toBe('number');
      expect(typeof bundle.bounding.y).toBe('number');
      expect(typeof bundle.bounding.width).toBe('number');
      expect(typeof bundle.bounding.height).toBe('number');
    });
    
    it('should include iframe chain when provided', () => {
      const input = createTestInput();
      const bundle = builder.createBundle(input, [0, 1]);
      
      expect(bundle.iframeChain).toEqual([0, 1]);
    });
    
    it('should include shadow hosts when provided', () => {
      const input = createTestInput();
      const bundle = builder.createBundle(input, undefined, ['/html/body/div[1]']);
      
      expect(bundle.shadowHosts).toEqual(['/html/body/div[1]']);
    });
  });
  
  // ==========================================================================
  // DATA ATTRIBUTE EXTRACTION
  // ==========================================================================
  
  describe('data attribute extraction', () => {
    it('should extract all data attributes', () => {
      const input = createTestInput({
        'data-testid': 'input-1',
        'data-automation': 'email-field',
        'data-custom': 'value',
      });
      
      const dataAttrs = builder.extractDataAttributes(input);
      
      expect(dataAttrs.testid).toBe('input-1');
      expect(dataAttrs.automation).toBe('email-field');
      expect(dataAttrs.custom).toBe('value');
    });
    
    it('should return empty object when no data attributes', () => {
      const div = document.createElement('div');
      document.body.appendChild(div);
      
      const dataAttrs = builder.extractDataAttributes(div);
      
      expect(Object.keys(dataAttrs).length).toBe(0);
    });
  });
  
  // ==========================================================================
  // COORDINATE EXTRACTION
  // ==========================================================================
  
  describe('coordinate extraction', () => {
    it('should extract center coordinates', () => {
      const button = createTestButton();
      // Mock getBoundingClientRect
      vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({
        left: 100,
        top: 200,
        width: 80,
        height: 40,
        right: 180,
        bottom: 240,
        x: 100,
        y: 200,
        toJSON: () => {},
      });
      
      const coords = builder.extractCoordinates(button);
      
      expect(coords.x).toBe(140); // 100 + 80/2
      expect(coords.y).toBe(220); // 200 + 40/2
    });
  });
  
  // ==========================================================================
  // EVENT TYPE INFERENCE
  // ==========================================================================
  
  describe('event type inference', () => {
    it('should infer click for buttons', () => {
      const button = createTestButton();
      const eventType = builder.inferEventType(button);
      
      expect(eventType).toBe('click');
    });
    
    it('should infer input for text inputs', () => {
      const input = createTestInput({ type: 'text' });
      const eventType = builder.inferEventType(input);
      
      expect(eventType).toBe('input');
    });
    
    it('should infer click for submit inputs', () => {
      const input = createTestInput({ type: 'submit' });
      const eventType = builder.inferEventType(input);
      
      expect(eventType).toBe('click');
    });
    
    it('should infer from event type', () => {
      const div = document.createElement('div');
      const clickEvent = createClickEvent();
      
      const eventType = builder.inferEventType(div, clickEvent);
      
      expect(eventType).toBe('click');
    });
  });
  
  // ==========================================================================
  // FLUENT API
  // ==========================================================================
  
  describe('fluent api', () => {
    it('should build step using fluent api', () => {
      const input = createTestInput();
      
      const step = builder
        .forElement(input)
        .withEvent('input')
        .withValue('test@example.com')
        .buildStep();
      
      expect(step.event).toBe('input');
      expect(step.value).toBe('test@example.com');
    });
    
    it('should support iframe chain in fluent api', () => {
      const input = createTestInput();
      
      const step = builder
        .forElement(input)
        .withEvent('input')
        .withIframeChain([0, 1, 2])
        .buildStep();
      
      expect(step.bundle?.iframeChain).toEqual([0, 1, 2]);
    });
    
    it('should support label override in fluent api', () => {
      const button = createTestButton();
      
      const step = builder
        .forElement(button)
        .withEvent('click')
        .withLabel('Custom Button Label')
        .buildStep();
      
      expect(step.label).toBe('Custom Button Label');
    });
    
    it('should throw without element', () => {
      expect(() => builder.buildStep()).toThrow();
    });
    
    it('should reset state after build', () => {
      const button = createTestButton();
      
      builder
        .forElement(button)
        .withEvent('click')
        .withLabel('Label 1')
        .buildStep();
      
      // Should throw because element was reset
      expect(() => builder.buildStep()).toThrow();
    });
  });
  
  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================
  
  describe('configuration', () => {
    it('should exclude bundle when configured', () => {
      const lightBuilder = new StepBuilder({ includeBundle: false });
      const button = createTestButton();
      
      const step = lightBuilder.buildFromClick(button);
      
      expect(step.bundle).toBeUndefined();
    });
    
    it('should use custom id prefix', () => {
      const customBuilder = new StepBuilder({ idPrefix: 'custom' });
      const button = createTestButton();
      
      const step = customBuilder.buildFromClick(button);
      
      expect(step.id).toMatch(/^custom_/);
    });
    
    it('should use custom start sequence', () => {
      const customBuilder = new StepBuilder({ startSequence: 100 });
      
      expect(customBuilder.getSequence()).toBe(100);
    });
  });
});

// ============================================================================
// FACTORY FUNCTION TESTS
// ============================================================================

describe('factory functions', () => {
  beforeEach(() => {
    resetStepBuilder();
  });
  
  afterEach(() => {
    document.body.innerHTML = '';
    resetStepBuilder();
  });
  
  it('createStepBuilder should create builder', () => {
    const builder = createStepBuilder();
    expect(builder).toBeInstanceOf(StepBuilder);
  });
  
  it('createLightweightBuilder should exclude bundles', () => {
    const builder = createLightweightBuilder();
    const button = document.createElement('button');
    document.body.appendChild(button);
    
    const step = builder.buildFromClick(button);
    
    expect(step.bundle).toBeUndefined();
  });
});

// ============================================================================
// SINGLETON TESTS
// ============================================================================

describe('singleton', () => {
  beforeEach(() => {
    resetStepBuilder();
  });
  
  afterEach(() => {
    document.body.innerHTML = '';
    resetStepBuilder();
  });
  
  it('getStepBuilder should return singleton', () => {
    const builder1 = getStepBuilder();
    const builder2 = getStepBuilder();
    
    expect(builder1).toBe(builder2);
  });
  
  it('resetStepBuilder should clear singleton', () => {
    const builder1 = getStepBuilder();
    resetStepBuilder();
    const builder2 = getStepBuilder();
    
    expect(builder1).not.toBe(builder2);
  });
});

// ============================================================================
// CONVENIENCE FUNCTION TESTS
// ============================================================================

describe('convenience functions', () => {
  beforeEach(() => {
    resetStepBuilder();
  });
  
  afterEach(() => {
    document.body.innerHTML = '';
    resetStepBuilder();
  });
  
  it('buildClickStep should build click step', () => {
    const button = document.createElement('button');
    document.body.appendChild(button);
    
    const step = buildClickStep(button);
    
    expect(step.event).toBe('click');
  });
  
  it('buildInputStep should build input step', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    
    const step = buildInputStep(input, 'test value');
    
    expect(step.event).toBe('input');
    expect(step.value).toBe('test value');
  });
  
  it('buildNavigationStep should build navigation step', () => {
    const step = buildNavigationStep('https://example.com');
    
    expect(step.event).toBe('open');
    expect(step.value).toBe('https://example.com');
  });
  
  it('createLocatorBundle should create bundle', () => {
    const input = document.createElement('input');
    input.id = 'test';
    document.body.appendChild(input);
    
    const bundle = createLocatorBundle(input);
    
    expect(bundle.tag).toBe('input');
    expect(bundle.id).toBe('test');
  });
});
