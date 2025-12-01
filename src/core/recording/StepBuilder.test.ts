/**
 * StepBuilder Test Suite
 * @module core/recording/StepBuilder.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  StepBuilder,
  createStepBuilder,
  buildStepFromEvent,
  buildClickStep,
  buildInputStep,
  buildNavigationStep,
  buildAssertStep,
  DEFAULT_STEP_TIMEOUT,
  MAX_DESCRIPTION_LENGTH,
  MAX_VALUE_LENGTH,
  MERGEABLE_STEP_TYPES,
  MERGE_WINDOW_MS,
  STEP_TEMPLATES,
} from './StepBuilder';
import type { CapturedEvent, ElementInfo } from './EventCapture';
import type { RecordedStep, StepTarget } from '../types/steps';

// ============================================================================
// MOCK DATA
// ============================================================================

function createMockElementInfo(overrides: Partial<ElementInfo> = {}): ElementInfo {
  return {
    tagName: 'button',
    id: 'test-btn',
    classNames: ['btn', 'primary'],
    name: 'submit',
    textContent: 'Click me',
    xpath: '/html/body/button',
    cssSelector: '#test-btn',
    aria: { 'aria-label': 'Submit button' },
    dataAttrs: { 'data-testid': 'submit-btn' },
    attributes: { type: 'submit' },
    isVisible: true,
    isInViewport: true,
    ...overrides,
  };
}

function createMockCapturedEvent(overrides: Partial<CapturedEvent> = {}): CapturedEvent {
  return {
    type: 'click',
    target: createMockElementInfo(),
    timestamp: Date.now(),
    data: {
      type: 'click',
      button: 0,
      clientX: 100,
      clientY: 200,
      pageX: 100,
      pageY: 200,
      offsetX: 10,
      offsetY: 10,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      metaKey: false,
    },
    isTrusted: true,
    ...overrides,
  };
}

function createMockTarget(overrides: Partial<StepTarget> = {}): StepTarget {
  return {
    tagName: 'button',
    id: 'test-btn',
    className: 'btn primary',
    name: 'submit',
    xpath: '/html/body/button',
    cssSelector: '#test-btn',
    textContent: 'Click me',
    attributes: {},
    ...overrides,
  };
}

// ============================================================================
// CONSTANT TESTS
// ============================================================================

describe('StepBuilder constants', () => {
  it('should have default timeout', () => {
    expect(DEFAULT_STEP_TIMEOUT).toBe(30000);
  });
  
  it('should have mergeable step types', () => {
    expect(MERGEABLE_STEP_TYPES).toContain('input');
    expect(MERGEABLE_STEP_TYPES).toContain('keypress');
  });
  
  it('should have merge window', () => {
    expect(MERGE_WINDOW_MS).toBe(500);
  });
  
  it('should have step templates', () => {
    expect(STEP_TEMPLATES.click).toBeDefined();
    expect(STEP_TEMPLATES.input).toBeDefined();
    expect(STEP_TEMPLATES.navigate).toBeDefined();
  });
});

// ============================================================================
// BUILDER TESTS
// ============================================================================

describe('StepBuilder', () => {
  let builder: StepBuilder;
  
  beforeEach(() => {
    builder = createStepBuilder();
  });
  
  describe('basic building', () => {
    it('should build step with required fields', () => {
      const step = builder
        .withType('click')
        .withTarget(createMockTarget())
        .build();
      
      expect(step.id).toBeDefined();
      expect(step.type).toBe('click');
      expect(step.timestamp).toBeDefined();
      expect(step.target).toBeDefined();
    });
    
    it('should generate unique IDs', () => {
      const step1 = builder.withType('click').withTarget(createMockTarget()).build();
      const step2 = builder.withType('click').withTarget(createMockTarget()).build();
      
      expect(step1.id).not.toBe(step2.id);
    });
    
    it('should throw without type', () => {
      expect(() => builder.withTarget(createMockTarget()).build()).toThrow();
    });
    
    it('should create default target if missing', () => {
      const step = builder.withType('click').build();
      
      expect(step.target).toBeDefined();
      expect(step.target.tagName).toBe('unknown');
    });
  });
  
  describe('from captured event', () => {
    it('should build step from captured event', () => {
      const event = createMockCapturedEvent();
      const step = builder.fromCapturedEvent(event).build();
      
      expect(step.type).toBe('click');
      expect(step.target.tagName).toBe('button');
      expect(step.timestamp).toBe(event.timestamp);
    });
    
    it('should map event types correctly', () => {
      const clickEvent = createMockCapturedEvent({ type: 'click' });
      const inputEvent = createMockCapturedEvent({
        type: 'input',
        data: { type: 'input', value: 'test', isComposing: false },
      });
      const keyEvent = createMockCapturedEvent({
        type: 'keydown',
        data: {
          type: 'keydown',
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          ctrlKey: false,
          shiftKey: false,
          altKey: false,
          metaKey: false,
          repeat: false,
          isComposing: false,
        },
      });
      
      expect(builder.fromCapturedEvent(clickEvent).build().type).toBe('click');
      expect(builder.fromCapturedEvent(inputEvent).build().type).toBe('input');
      expect(builder.fromCapturedEvent(keyEvent).build().type).toBe('keypress');
    });
    
    it('should extract value from input event', () => {
      const event = createMockCapturedEvent({
        type: 'input',
        data: { type: 'input', value: 'hello world', isComposing: false },
      });
      
      const step = builder.fromCapturedEvent(event).build();
      
      expect(step.value).toBe('hello world');
    });
    
    it('should extract key from keyboard event', () => {
      const event = createMockCapturedEvent({
        type: 'keydown',
        data: {
          type: 'keydown',
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          ctrlKey: false,
          shiftKey: false,
          altKey: false,
          metaKey: false,
          repeat: false,
          isComposing: false,
        },
      });
      
      const step = builder.fromCapturedEvent(event).build();
      
      expect(step.value).toBe('Enter');
    });
    
    it('should include coordinates in metadata', () => {
      const event = createMockCapturedEvent();
      const step = builder.fromCapturedEvent(event).build();
      
      expect(step.metadata?.coordinates).toEqual({ x: 100, y: 200 });
    });
    
    it('should include modifier keys in metadata', () => {
      const event = createMockCapturedEvent({
        data: {
          type: 'click',
          button: 0,
          clientX: 100,
          clientY: 200,
          pageX: 100,
          pageY: 200,
          offsetX: 10,
          offsetY: 10,
          ctrlKey: true,
          shiftKey: true,
          altKey: false,
          metaKey: false,
        },
      });
      
      const step = builder.fromCapturedEvent(event).build();
      
      expect(step.metadata?.modifiers?.ctrl).toBe(true);
      expect(step.metadata?.modifiers?.shift).toBe(true);
    });
  });
  
  describe('builder methods', () => {
    it('should set value', () => {
      const step = builder
        .withType('input')
        .withTarget(createMockTarget())
        .withValue('test value')
        .build();
      
      expect(step.value).toBe('test value');
    });
    
    it('should truncate long values', () => {
      const longValue = 'a'.repeat(MAX_VALUE_LENGTH + 100);
      
      const step = builder
        .withType('input')
        .withTarget(createMockTarget())
        .withValue(longValue)
        .build();
      
      expect(step.value?.length).toBe(MAX_VALUE_LENGTH);
    });
    
    it('should set timestamp', () => {
      const timestamp = 1234567890;
      
      const step = builder
        .withType('click')
        .withTarget(createMockTarget())
        .withTimestamp(timestamp)
        .build();
      
      expect(step.timestamp).toBe(timestamp);
    });
    
    it('should set ID', () => {
      const step = builder
        .withType('click')
        .withTarget(createMockTarget())
        .withId('custom-id')
        .build();
      
      expect(step.id).toBe('custom-id');
    });
    
    it('should set description', () => {
      const step = builder
        .withType('click')
        .withTarget(createMockTarget())
        .withDescription('Click the submit button')
        .build();
      
      expect(step.metadata?.description).toBe('Click the submit button');
    });
    
    it('should truncate long descriptions', () => {
      const longDesc = 'a'.repeat(MAX_DESCRIPTION_LENGTH + 100);
      
      const step = builder
        .withType('click')
        .withTarget(createMockTarget())
        .withDescription(longDesc)
        .build();
      
      expect(step.metadata?.description?.length).toBeLessThanOrEqual(MAX_DESCRIPTION_LENGTH + 3);
    });
    
    it('should set timeout', () => {
      const step = builder
        .withType('click')
        .withTarget(createMockTarget())
        .withTimeout(5000)
        .build();
      
      expect(step.metadata?.timeout).toBe(5000);
    });
    
    it('should mark as optional', () => {
      const step = builder
        .withType('click')
        .withTarget(createMockTarget())
        .asOptional()
        .build();
      
      expect(step.metadata?.optional).toBe(true);
    });
    
    it('should set wait before', () => {
      const step = builder
        .withType('click')
        .withTarget(createMockTarget())
        .withWaitBefore(1000)
        .build();
      
      expect(step.metadata?.waitBefore).toBe(1000);
    });
    
    it('should set wait after', () => {
      const step = builder
        .withType('click')
        .withTarget(createMockTarget())
        .withWaitAfter(500)
        .build();
      
      expect(step.metadata?.waitAfter).toBe(500);
    });
    
    it('should set locator bundle', () => {
      const bundle = {
        id: 'test-btn',
        tagName: 'button',
        xpath: '/html/body/button',
        cssSelector: '#test-btn',
        timestamp: Date.now(),
      };
      
      const step = builder
        .withType('click')
        .withTarget(createMockTarget())
        .withLocatorBundle(bundle as any)
        .build();
      
      expect(step.locatorBundle).toBe(bundle);
    });
    
    it('should set screenshot', () => {
      const step = builder
        .withType('click')
        .withTarget(createMockTarget())
        .withScreenshot('data:image/png;base64,xxx')
        .build();
      
      expect(step.screenshot).toBe('data:image/png;base64,xxx');
    });
    
    it('should apply template', () => {
      const step = builder
        .fromTemplate(STEP_TEMPLATES.click)
        .withTarget(createMockTarget())
        .build();
      
      expect(step.type).toBe('click');
    });
    
    it('should reset between builds', () => {
      const step1 = builder
        .withType('click')
        .withTarget(createMockTarget())
        .withValue('first')
        .build();
      
      const step2 = builder
        .withType('input')
        .withTarget(createMockTarget())
        .build();
      
      expect(step1.value).toBe('first');
      expect(step2.value).toBeUndefined();
    });
  });
  
  describe('auto-generated descriptions', () => {
    it('should generate click description', () => {
      const step = builder
        .withType('click')
        .withTarget(createMockTarget({ id: 'submit-btn' }))
        .build();
      
      expect(step.metadata?.description).toContain('Click');
      expect(step.metadata?.description).toContain('#submit-btn');
    });
    
    it('should generate input description', () => {
      const step = builder
        .withType('input')
        .withTarget(createMockTarget())
        .withValue('hello')
        .build();
      
      expect(step.metadata?.description).toContain('Type');
      expect(step.metadata?.description).toContain('hello');
    });
    
    it('should generate navigation description', () => {
      const step = builder
        .withType('navigate')
        .withTarget({ tagName: 'window', xpath: '', cssSelector: '' })
        .withValue('https://example.com')
        .build();
      
      expect(step.metadata?.description).toContain('Navigate');
    });
  });
  
  describe('validation', () => {
    it('should validate valid step', () => {
      const step = builder
        .withType('click')
        .withTarget(createMockTarget())
        .build();
      
      const result = builder.validate(step);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should detect missing type', () => {
      const step = {
        id: 'test',
        timestamp: Date.now(),
        target: createMockTarget(),
      } as RecordedStep;
      
      const result = builder.validate(step);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_TYPE')).toBe(true);
    });
    
    it('should detect missing target', () => {
      const step = {
        id: 'test',
        type: 'click',
        timestamp: Date.now(),
      } as RecordedStep;
      
      const result = builder.validate(step);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_TARGET')).toBe(true);
    });
    
    it('should detect invalid timestamp', () => {
      const step = {
        id: 'test',
        type: 'click',
        timestamp: 0,
        target: createMockTarget(),
      } as RecordedStep;
      
      const result = builder.validate(step);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_TIMESTAMP')).toBe(true);
    });
    
    it('should warn about missing locator bundle', () => {
      const step = builder
        .withType('click')
        .withTarget(createMockTarget())
        .build();
      
      const result = builder.validate(step);
      
      expect(result.warnings.some(w => w.code === 'MISSING_LOCATOR_BUNDLE')).toBe(true);
    });
    
    it('should build and validate together', () => {
      const { step, validation } = builder
        .withType('click')
        .withTarget(createMockTarget())
        .buildValidated();
      
      expect(step).toBeDefined();
      expect(validation).toBeDefined();
      expect(validation.valid).toBe(true);
    });
  });
  
  describe('normalization', () => {
    it('should normalize target tag name', () => {
      const step = builder
        .withType('click')
        .withTarget({ ...createMockTarget(), tagName: 'BUTTON' })
        .build();
      
      const normalized = builder.normalize(step);
      
      expect(normalized.target.tagName).toBe('button');
    });
    
    it('should trim text content', () => {
      const step = builder
        .withType('click')
        .withTarget({ ...createMockTarget(), textContent: '  hello  ' })
        .build();
      
      const normalized = builder.normalize(step);
      
      expect(normalized.target.textContent).toBe('hello');
    });
    
    it('should set default timeout', () => {
      const step = {
        id: 'test',
        type: 'click' as const,
        timestamp: Date.now(),
        target: createMockTarget(),
      };
      
      const normalized = builder.normalize(step);
      
      expect(normalized.metadata?.timeout).toBe(DEFAULT_STEP_TIMEOUT);
    });
  });
  
  describe('step merging', () => {
    it('should identify mergeable steps', () => {
      const prev: RecordedStep = {
        id: 'step-1',
        type: 'input',
        timestamp: 1000,
        target: createMockTarget(),
        value: 'hel',
      };
      
      const current: RecordedStep = {
        id: 'step-2',
        type: 'input',
        timestamp: 1200,
        target: createMockTarget(),
        value: 'hello',
      };
      
      expect(builder.shouldMerge(prev, current)).toBe(true);
    });
    
    it('should not merge different types', () => {
      const prev: RecordedStep = {
        id: 'step-1',
        type: 'input',
        timestamp: 1000,
        target: createMockTarget(),
      };
      
      const current: RecordedStep = {
        id: 'step-2',
        type: 'click',
        timestamp: 1200,
        target: createMockTarget(),
      };
      
      expect(builder.shouldMerge(prev, current)).toBe(false);
    });
    
    it('should not merge outside time window', () => {
      const prev: RecordedStep = {
        id: 'step-1',
        type: 'input',
        timestamp: 1000,
        target: createMockTarget(),
      };
      
      const current: RecordedStep = {
        id: 'step-2',
        type: 'input',
        timestamp: 1000 + MERGE_WINDOW_MS + 100,
        target: createMockTarget(),
      };
      
      expect(builder.shouldMerge(prev, current)).toBe(false);
    });
    
    it('should not merge different targets', () => {
      const prev: RecordedStep = {
        id: 'step-1',
        type: 'input',
        timestamp: 1000,
        target: createMockTarget({ id: 'input-1' }),
      };
      
      const current: RecordedStep = {
        id: 'step-2',
        type: 'input',
        timestamp: 1200,
        target: createMockTarget({ id: 'input-2' }),
      };
      
      expect(builder.shouldMerge(prev, current)).toBe(false);
    });
    
    it('should merge steps correctly', () => {
      const prev: RecordedStep = {
        id: 'step-1',
        type: 'input',
        timestamp: 1000,
        target: createMockTarget(),
        value: 'hel',
      };
      
      const current: RecordedStep = {
        id: 'step-2',
        type: 'input',
        timestamp: 1200,
        target: createMockTarget(),
        value: 'hello',
      };
      
      const merged = builder.mergeSteps(prev, current);
      
      expect(merged.id).toBe(prev.id);
      expect(merged.value).toBe('hello');
      expect(merged.timestamp).toBe(1200);
      expect(merged.metadata?.mergedFrom).toBe('step-1');
    });
    
    it('should merge when building from event with context', () => {
      const prevStep: RecordedStep = {
        id: 'step-1',
        type: 'input',
        timestamp: Date.now() - 100,
        target: createMockTarget(),
        value: 'hel',
      };
      
      const event = createMockCapturedEvent({
        type: 'input',
        target: createMockElementInfo(),
        data: { type: 'input', value: 'hello', isComposing: false },
      });
      
      const step = builder
        .fromCapturedEvent(event, { previousStep: prevStep })
        .build();
      
      expect(step.value).toBe('hello');
    });
  });
});

// ============================================================================
// FACTORY FUNCTION TESTS
// ============================================================================

describe('buildStepFromEvent', () => {
  it('should build step from event', () => {
    const event = createMockCapturedEvent();
    const step = buildStepFromEvent(event);
    
    expect(step.type).toBe('click');
    expect(step.target.tagName).toBe('button');
  });
});

describe('buildClickStep', () => {
  it('should build click step', () => {
    const target = createMockTarget();
    const step = buildClickStep(target);
    
    expect(step.type).toBe('click');
    expect(step.target).toEqual(target);
  });
  
  it('should accept options', () => {
    const target = createMockTarget();
    const step = buildClickStep(target, {
      description: 'Custom click',
      metadata: { timeout: 5000 },
    });
    
    expect(step.metadata?.description).toBe('Custom click');
    expect(step.metadata?.timeout).toBe(5000);
  });
});

describe('buildInputStep', () => {
  it('should build input step', () => {
    const target = createMockTarget();
    const step = buildInputStep(target, 'test value');
    
    expect(step.type).toBe('input');
    expect(step.value).toBe('test value');
  });
});

describe('buildNavigationStep', () => {
  it('should build navigation step', () => {
    const step = buildNavigationStep('https://example.com');
    
    expect(step.type).toBe('navigate');
    expect(step.value).toBe('https://example.com');
    expect(step.target.tagName).toBe('window');
  });
});

describe('buildAssertStep', () => {
  it('should build assertion step', () => {
    const target = createMockTarget();
    const step = buildAssertStep(target, { type: 'visible' });
    
    expect(step.type).toBe('assert');
    expect(step.metadata?.assertion).toEqual({ type: 'visible' });
  });
  
  it('should support different assertion types', () => {
    const target = createMockTarget();
    
    const textAssert = buildAssertStep(target, { type: 'text', expected: 'Hello' });
    expect(textAssert.metadata?.assertion?.expected).toBe('Hello');
    
    const attrAssert = buildAssertStep(target, { type: 'attribute', attribute: 'disabled' });
    expect(attrAssert.metadata?.assertion?.attribute).toBe('disabled');
  });
});
