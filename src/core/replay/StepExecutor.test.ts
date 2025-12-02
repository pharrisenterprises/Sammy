/**
 * Tests for StepExecutor
 * @module core/replay/StepExecutor.test
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  StepExecutor,
  createStepExecutor,
  createFastStepExecutor,
  createTolerantStepExecutor,
  createDebugStepExecutor,
  getStepExecutor,
  resetStepExecutor,
  executeStep,
  executeSteps,
  DEFAULT_EXECUTION_OPTIONS,
  type StepExecutionContext,
  type StepExecutionResult,
} from './StepExecutor';
import type { Step } from '../types/Step';
import type { LocatorBundle } from '../locators/LocatorBundle';

// ============================================================================
// TEST HELPERS
// ============================================================================

function createTestBundle(overrides: Partial<LocatorBundle> = {}): LocatorBundle {
  return {
    tag: 'input',
    id: 'test-id',
    name: 'test-name',
    placeholder: null,
    aria: null,
    dataAttrs: {},
    text: '',
    visibleText: '',
    css: '',
    xpath: '/html/body/input',
    classes: [],
    pageUrl: 'http://test.com',
    bounding: { x: 100, y: 100, width: 100, height: 30 },
    iframeChain: null,
    shadowHosts: null,
    ...overrides,
  };
}

function createTestStep(overrides: Partial<Step> = {}): Step {
  return {
    id: '1',
    name: 'Test Step',
    event: 'click',
    path: '/html/body/button',
    value: '',
    label: 'Submit Button',
    x: 100,
    y: 100,
    bundle: createTestBundle({ tag: 'button' }),
    ...overrides,
  };
}

function createElement(
  tag: string,
  attrs: Record<string, string> = {}
): HTMLElement {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    element.setAttribute(key, value);
  }
  document.body.appendChild(element);
  
  // Mock getBoundingClientRect for JSDOM
  element.getBoundingClientRect = vi.fn(() => ({
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    top: 0,
    right: 100,
    bottom: 50,
    left: 0,
    toJSON: () => {},
  }));
  
  // Mock scrollIntoView for JSDOM
  element.scrollIntoView = vi.fn();
  
  return element;
}

function createInput(
  type: string = 'text',
  attrs: Record<string, string> = {}
): HTMLInputElement {
  return createElement('input', { type, ...attrs }) as HTMLInputElement;
}

function cleanupElements(): void {
  document.body.innerHTML = '';
}

// ============================================================================
// TESTS
// ============================================================================

describe('StepExecutor', () => {
  let executor: StepExecutor;
  
  beforeEach(() => {
    vi.useFakeTimers();
    resetStepExecutor();
    cleanupElements();
    executor = new StepExecutor({ humanLike: false }); // Fast for tests
  });
  
  afterEach(() => {
    vi.useRealTimers();
    resetStepExecutor();
    cleanupElements();
  });
  
  // ==========================================================================
  // VALIDATION TESTS
  // ==========================================================================
  
  describe('validation', () => {
    it('should fail for null step', async () => {
      const resultPromise = executor.execute(null as unknown as Step);
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('null');
    });
    
    it('should fail for missing event type', async () => {
      const step = createTestStep({ event: undefined as unknown as 'click' });
      
      const resultPromise = executor.execute(step);
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('event');
    });
    
    it('should fail for invalid event type', async () => {
      const step = createTestStep({ event: 'invalid' as unknown as 'click' });
      
      const resultPromise = executor.execute(step);
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid event type');
    });
    
    it('should fail for missing bundle and path', async () => {
      const step = createTestStep({ bundle: undefined, path: '' });
      
      const resultPromise = executor.execute(step);
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('bundle');
    });
  });
  
  // ==========================================================================
  // CLICK EXECUTION TESTS
  // ==========================================================================
  
  describe('click execution', () => {
    it('should execute click step successfully', async () => {
      const button = createElement('button', { id: 'test-id' });
      let clicked = false;
      button.addEventListener('click', () => { clicked = true; });
      
      const step = createTestStep({
        event: 'click',
        bundle: createTestBundle({ tag: 'button', id: 'test-id' }),
      });
      
      const resultPromise = executor.execute(step);
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      
      expect(result.success).toBe(true);
      expect(result.status).toBe('passed');
      expect(clicked).toBe(true);
    });
    
    it('should fail when element not found', async () => {
      const step = createTestStep({
        event: 'click',
        bundle: createTestBundle({ id: 'nonexistent' }),
      });
      
      const resultPromise = executor.execute(step, {}, { findTimeout: 100 });
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
    
    it('should skip when element not found with skipOnNotFound', async () => {
      const step = createTestStep({
        event: 'click',
        bundle: createTestBundle({ id: 'nonexistent' }),
      });
      
      const resultPromise = executor.execute(step, {}, { 
        findTimeout: 100,
        skipOnNotFound: true,
      });
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      
      expect(result.status).toBe('skipped');
    });
  });
  
  // ==========================================================================
  // INPUT EXECUTION TESTS
  // ==========================================================================
  
  describe('input execution', () => {
    it('should execute input step with recorded value', async () => {
      const input = createInput('text', { id: 'test-id' });
      
      const step = createTestStep({
        event: 'input',
        value: 'Hello World',
        bundle: createTestBundle({ tag: 'input', id: 'test-id' }),
      });
      
      const resultPromise = executor.execute(step);
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      
      expect(result.success).toBe(true);
      expect(input.value).toBe('Hello World');
      expect(result.valueSource).toBe('recorded');
    });
    
    it('should use CSV value (direct match)', async () => {
      const input = createInput('text', { id: 'test-id' });
      
      const step = createTestStep({
        event: 'input',
        label: 'Email',
        value: 'original@test.com',
        bundle: createTestBundle({ tag: 'input', id: 'test-id' }),
      });
      
      const context: StepExecutionContext = {
        csvValues: { 'Email': 'csv@test.com' },
      };
      
      const resultPromise = executor.execute(step, context);
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      
      expect(result.success).toBe(true);
      expect(input.value).toBe('csv@test.com');
      expect(result.valueSource).toBe('csv-direct');
      expect(result.usedValue).toBe('csv@test.com');
    });
    
    it('should use CSV value (mapped match)', async () => {
      const input = createInput('text', { id: 'test-id' });
      
      const step = createTestStep({
        event: 'input',
        label: 'User Email',
        value: 'original@test.com',
        bundle: createTestBundle({ tag: 'input', id: 'test-id' }),
      });
      
      const context: StepExecutionContext = {
        csvValues: { 'email_column': 'mapped@test.com' },
        fieldMappings: { 'email_column': 'User Email' },
      };
      
      const resultPromise = executor.execute(step, context);
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      
      expect(result.success).toBe(true);
      expect(input.value).toBe('mapped@test.com');
      expect(result.valueSource).toBe('csv-mapped');
    });
  });
  
  // ==========================================================================
  // ENTER EXECUTION TESTS
  // ==========================================================================
  
  describe('enter execution', () => {
    it('should execute enter step', async () => {
      const input = createInput('text', { id: 'test-id' });
      let enterPressed = false;
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') enterPressed = true;
      });
      
      const step = createTestStep({
        event: 'enter',
        bundle: createTestBundle({ tag: 'input', id: 'test-id' }),
      });
      
      const resultPromise = executor.execute(step);
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      
      expect(result.success).toBe(true);
      expect(enterPressed).toBe(true);
    });
    
    it('should set value before pressing enter', async () => {
      const input = createInput('text', { id: 'test-id' });
      
      const step = createTestStep({
        event: 'enter',
        value: 'search query',
        bundle: createTestBundle({ tag: 'input', id: 'test-id' }),
      });
      
      const resultPromise = executor.execute(step);
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      
      expect(result.success).toBe(true);
      expect(input.value).toBe('search query');
      expect(result.usedValue).toBe('search query');
    });
  });
  
  // ==========================================================================
  // OPEN EXECUTION TESTS
  // ==========================================================================
  
  describe('open execution', () => {
    it('should execute open step', async () => {
      const step = createTestStep({
        event: 'open',
        path: 'https://example.com',
        bundle: undefined,
      });
      
      const resultPromise = executor.execute(step, { pageUrl: 'https://example.com' });
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      
      expect(result.success).toBe(true);
      expect(result.usedValue).toBe('https://example.com');
    });
    
    it('should fail open step without URL', async () => {
      const step = createTestStep({
        event: 'open',
        path: '',
        value: '',
        bundle: undefined,
      });
      
      const resultPromise = executor.execute(step, {});
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('URL');
    });
  });
  
  // ==========================================================================
  // EXECUTE ALL TESTS
  // ==========================================================================
  
  describe('executeAll', () => {
    it('should execute multiple steps', async () => {
      createElement('button', { id: 'btn-1' });
      createElement('button', { id: 'btn-2' });
      
      const steps: Step[] = [
        createTestStep({
          id: '1',
          event: 'click',
          bundle: createTestBundle({ id: 'btn-1', tag: 'button' }),
        }),
        createTestStep({
          id: '2',
          event: 'click',
          bundle: createTestBundle({ id: 'btn-2', tag: 'button' }),
        }),
      ];
      
      const resultPromise = executor.executeAll(steps);
      await vi.runAllTimersAsync();
      const results = await resultPromise;
      
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });
    
    it('should stop on failure by default', async () => {
      createElement('button', { id: 'btn-2' });
      
      const steps: Step[] = [
        createTestStep({
          id: '1',
          event: 'click',
          bundle: createTestBundle({ 
            id: 'nonexistent',
            tag: 'span',  // Different tag to ensure no match
            xpath: '//span[@id="nonexistent"]',
          }),
        }),
        createTestStep({
          id: '2',
          event: 'click',
          bundle: createTestBundle({ id: 'btn-2', tag: 'button' }),
        }),
      ];
      
      const resultPromise = executor.executeAll(steps, {}, { findTimeout: 100, maxRetries: 0 });
      await vi.runAllTimersAsync();
      const results = await resultPromise;
      
      expect(results).toHaveLength(1); // Stopped after first failure
      expect(results[0].success).toBe(false);
    });
    
    it('should continue on failure with skipOnNotFound', async () => {
      createElement('button', { id: 'btn-2' });
      
      const steps: Step[] = [
        createTestStep({
          id: '1',
          event: 'click',
          bundle: createTestBundle({ 
            id: 'nonexistent',
            tag: 'span',  // Different tag to ensure no match
            xpath: '//span[@id="nonexistent"]',
          }),
        }),
        createTestStep({
          id: '2',
          event: 'click',
          bundle: createTestBundle({ id: 'btn-2', tag: 'button' }),
        }),
      ];
      
      const resultPromise = executor.executeAll(steps, {}, { 
        findTimeout: 100,
        maxRetries: 0,
        skipOnNotFound: true,
      });
      await vi.runAllTimersAsync();
      const results = await resultPromise;
      
      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('skipped');
      expect(results[1].success).toBe(true);
    });
  });
  
  // ==========================================================================
  // OPTIONS TESTS
  // ==========================================================================
  
  describe('options', () => {
    it('should use default options', () => {
      const opts = executor.getOptions();
      
      expect(opts.findTimeout).toBe(DEFAULT_EXECUTION_OPTIONS.findTimeout);
      expect(opts.maxRetries).toBe(DEFAULT_EXECUTION_OPTIONS.maxRetries);
    });
    
    it('should update options', () => {
      executor.setOptions({ findTimeout: 5000 });
      
      expect(executor.getOptions().findTimeout).toBe(5000);
    });
  });
  
  // ==========================================================================
  // RESULT STRUCTURE TESTS
  // ==========================================================================
  
  describe('result structure', () => {
    it('should include step in result', async () => {
      createElement('button', { id: 'test-id' });
      
      const step = createTestStep({
        bundle: createTestBundle({ tag: 'button', id: 'test-id' }),
      });
      
      const resultPromise = executor.execute(step);
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      
      expect(result.step).toBe(step);
    });
    
    it('should include find result', async () => {
      createElement('button', { id: 'test-id' });
      
      const step = createTestStep({
        bundle: createTestBundle({ tag: 'button', id: 'test-id' }),
      });
      
      const resultPromise = executor.execute(step);
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      
      expect(result.findResult).toBeDefined();
      expect(result.findResult?.element).toBeDefined();
    });
    
    it('should include timing information', async () => {
      createElement('button', { id: 'test-id' });
      
      const step = createTestStep({
        bundle: createTestBundle({ tag: 'button', id: 'test-id' }),
      });
      
      const resultPromise = executor.execute(step);
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.startTime).toBeDefined();
      expect(result.endTime).toBeDefined();
    });
  });
});

// ============================================================================
// FACTORY AND SINGLETON TESTS
// ============================================================================

describe('factory and singleton', () => {
  beforeEach(() => {
    resetStepExecutor();
    cleanupElements();
  });
  
  afterEach(() => {
    resetStepExecutor();
    cleanupElements();
  });
  
  describe('createStepExecutor', () => {
    it('should create executor with options', () => {
      const executor = createStepExecutor({ findTimeout: 5000 });
      expect(executor.getOptions().findTimeout).toBe(5000);
    });
  });
  
  describe('createFastStepExecutor', () => {
    it('should create fast executor', () => {
      const executor = createFastStepExecutor();
      expect(executor.getOptions().findTimeout).toBe(500);
      expect(executor.getOptions().humanLike).toBe(false);
    });
  });
  
  describe('createTolerantStepExecutor', () => {
    it('should create tolerant executor', () => {
      const executor = createTolerantStepExecutor();
      expect(executor.getOptions().findTimeout).toBe(5000);
      expect(executor.getOptions().skipOnNotFound).toBe(true);
    });
  });
  
  describe('createDebugStepExecutor', () => {
    it('should create debug executor', () => {
      const executor = createDebugStepExecutor();
      expect(executor.getOptions().highlightElement).toBe(true);
      expect(executor.getOptions().highlightDuration).toBe(500);
    });
  });
  
  describe('getStepExecutor', () => {
    it('should return same instance', () => {
      const e1 = getStepExecutor();
      const e2 = getStepExecutor();
      expect(e1).toBe(e2);
    });
  });
  
  describe('resetStepExecutor', () => {
    it('should reset instance', () => {
      const e1 = getStepExecutor();
      resetStepExecutor();
      const e2 = getStepExecutor();
      expect(e2).not.toBe(e1);
    });
  });
});

// ============================================================================
// CONVENIENCE FUNCTION TESTS
// ============================================================================

describe('convenience functions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetStepExecutor();
    cleanupElements();
  });
  
  afterEach(() => {
    vi.useRealTimers();
    resetStepExecutor();
    cleanupElements();
  });
  
  describe('executeStep', () => {
    it('should execute with default executor', async () => {
      createElement('button', { id: 'test-id' });
      
      const step = createTestStep({
        bundle: createTestBundle({ tag: 'button', id: 'test-id' }),
      });
      
      const resultPromise = executeStep(step);
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      
      expect(result.success).toBe(true);
    });
  });
  
  describe('executeSteps', () => {
    it('should execute multiple with default executor', async () => {
      createElement('button', { id: 'btn-1' });
      createElement('button', { id: 'btn-2' });
      
      const steps: Step[] = [
        createTestStep({
          id: '1',
          bundle: createTestBundle({ id: 'btn-1', tag: 'button' }),
        }),
        createTestStep({
          id: '2',
          bundle: createTestBundle({ id: 'btn-2', tag: 'button' }),
        }),
      ];
      
      const resultPromise = executeSteps(steps);
      await vi.runAllTimersAsync();
      const results = await resultPromise;
      
      expect(results).toHaveLength(2);
    });
  });
});
