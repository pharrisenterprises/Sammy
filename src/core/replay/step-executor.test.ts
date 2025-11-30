/**
 * @fileoverview Tests for step executor
 * @module core/replay/step-executor.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  StepExecutor,
  executeStep,
  executeSteps,
  validateStep,
  describeStep,
  getErrorSummary,
  createExecutionReport,
  DEFAULT_EXECUTION_OPTIONS,
  ERROR_MESSAGES
} from './step-executor';
import { createStep, createBundle } from '../types';
import type { Step } from '../types';

// Mock the locators module
vi.mock('../locators', () => {
  const mockElement = { tagName: 'INPUT', nodeType: 1 };
  return {
    executeStrategy: vi.fn().mockResolvedValue({
      found: true,
      element: mockElement,
      strategy: 'id',
      confidence: 90
    }),
    performClick: vi.fn().mockResolvedValue(undefined),
    performInput: vi.fn().mockResolvedValue(undefined),
    performEnter: vi.fn().mockResolvedValue(undefined),
    isElementVisible: vi.fn().mockReturnValue(true),
    isElementInteractable: vi.fn().mockReturnValue(true),
    waitForElementStable: vi.fn().mockResolvedValue(true)
  };
});

describe('Step Executor', () => {
  let dom: JSDOM;
  let testStep: Step;

  beforeEach(() => {
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <input id="username" name="username" type="text">
          <button id="submit-btn" type="submit">Submit</button>
        </body>
      </html>
    `, { url: 'http://localhost/test' });
    
    global.document = dom.window.document;
    global.window = dom.window as unknown as (Window & typeof globalThis);

    testStep = createStep({
      event: 'click',
      bundle: createBundle({ id: 'submit-btn', tag: 'button' }),
      value: '',
      path: '//*[@id="submit-btn"]',
      x: 100,
      y: 200
    });

    vi.spyOn(performance, 'now').mockReturnValue(1000);
  });

  afterEach(() => {
    dom.window.close();
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // CONSTANTS
  // ==========================================================================

  describe('Constants', () => {
    it('should have correct default options', () => {
      expect(DEFAULT_EXECUTION_OPTIONS.timeout).toBe(5000);
      expect(DEFAULT_EXECUTION_OPTIONS.waitForStable).toBe(true);
      expect(DEFAULT_EXECUTION_OPTIONS.scrollIntoView).toBe(true);
      expect(DEFAULT_EXECUTION_OPTIONS.verifyInteractable).toBe(true);
    });

    it('should have error messages for all codes', () => {
      expect(ERROR_MESSAGES.ELEMENT_NOT_FOUND).toBeDefined();
      expect(ERROR_MESSAGES.CLICK_FAILED).toBeDefined();
      expect(ERROR_MESSAGES.INPUT_FAILED).toBeDefined();
    });
  });

  // ==========================================================================
  // STEP EXECUTOR CLASS
  // ==========================================================================

  describe('StepExecutor', () => {
    describe('execute', () => {
      it('should execute click step', async () => {
        const executor = new StepExecutor();
        
        const result = await executor.execute(testStep);

        expect(result.success).toBe(true);
        expect(result.step).toBe(testStep);
        expect(result.phases.length).toBeGreaterThan(0);
      });

      it('should execute input step', async () => {
        const inputStep = createStep({
          event: 'input',
          bundle: createBundle({ id: 'username', tag: 'input' }),
          value: 'testvalue',
          path: '//*[@id="username"]',
          x: 100,
          y: 200
        });

        const executor = new StepExecutor();
        const result = await executor.execute(inputStep);

        expect(result.success).toBe(true);
        expect(result.usedValue).toBe('testvalue');
      });

      it('should execute enter step', async () => {
        const enterStep = createStep({
          event: 'enter',
          bundle: createBundle({ id: 'username', tag: 'input' }),
          value: '{{name}}',
          path: '//*[@id="username"]',
          x: 100,
          y: 200
        });
        const executor = new StepExecutor();
        const result = await executor.execute(enterStep);

        expect(result.success).toBe(true);
      });

      it('should execute open step', async () => {
        const openStep = createStep({
          event: 'open',
          bundle: createBundle({ pageUrl: 'http://localhost/test', tag: 'document' }),
          value: 'http://localhost/test',
          path: '',
          x: 0,
          y: 0
        });

        const executor = new StepExecutor();
        const result = await executor.execute(openStep);

        expect(result.success).toBe(true);
      });

      it('should use injected value for input', async () => {
        const inputStep = createStep({
          event: 'input',
          bundle: createBundle({ id: 'username', tag: 'input' }),
          value: 'original',
          path: '//*[@id="username"]',
          x: 100,
          y: 200
        });

        const executor = new StepExecutor();
        const result = await executor.execute(inputStep, {
          injectedValue: 'injected'
        });

        expect(result.success).toBe(true);
        expect(result.usedValue).toBe('injected');
      });

      it('should handle element not found', async () => {
        const { executeStrategy } = await import('../locators');
        vi.mocked(executeStrategy).mockResolvedValueOnce({
          found: false,
          element: null,
          strategy: null,
          confidence: 0,
          duration: 100,
          attempts: [],
          context: null,
          inIframe: false,
          inShadowDom: false,
          matchScore: 0
        });

        const executor = new StepExecutor();
        const result = await executor.execute(testStep);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('ELEMENT_NOT_FOUND');
      });

      it('should handle element not interactable', async () => {
        const { isElementInteractable } = await import('../locators');
        vi.mocked(isElementInteractable).mockReturnValueOnce(false);

        const executor = new StepExecutor();
        const result = await executor.execute(testStep);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('ELEMENT_NOT_INTERACTABLE');
      });

      it('should track execution phases', async () => {
        const executor = new StepExecutor();
        const result = await executor.execute(testStep);

        expect(result.phases.some(p => p.name === 'validate')).toBe(true);
        expect(result.phases.some(p => p.name === 'locate')).toBe(true);
        expect(result.phases.some(p => p.name === 'click')).toBe(true);
      });

      it('should return duration', async () => {
        const executor = new StepExecutor();
        const result = await executor.execute(testStep);

        expect(result.duration).toBeGreaterThanOrEqual(0);
      });
    });

    describe('hooks', () => {
      it('should run pre-hooks', async () => {
        const executor = new StepExecutor();
        const preHook = vi.fn().mockReturnValue(true);
        executor.addPreHook(preHook);

        await executor.execute(testStep);

        expect(preHook).toHaveBeenCalled();
      });

      it('should stop if pre-hook returns false', async () => {
        const executor = new StepExecutor();
        executor.addPreHook(() => false);

        const result = await executor.execute(testStep);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('VALIDATION_FAILED');
      });

      it('should run post-hooks', async () => {
        const executor = new StepExecutor();
        const postHook = vi.fn();
        executor.addPostHook(postHook);

        await executor.execute(testStep);

        expect(postHook).toHaveBeenCalled();
      });

      it('should clear hooks', () => {
        const executor = new StepExecutor();
        executor.addPreHook(() => true);
        executor.addPostHook(() => {});

        executor.clearHooks();

        // No way to check directly, but it shouldn't throw
      });
    });

    describe('validation', () => {
      it('should reject invalid event type', async () => {
        const invalidStep = { ...testStep, event: 'invalid' as any };
        const executor = new StepExecutor();

        const result = await executor.execute(invalidStep);

        expect(result.success).toBe(false);
      });

      it('should reject missing bundle', async () => {
        const invalidStep = { ...testStep, bundle: null as any };
        const executor = new StepExecutor();

        const result = await executor.execute(invalidStep);

        expect(result.success).toBe(false);
      });
    });
  });

  // ==========================================================================
  // STANDALONE FUNCTIONS
  // ==========================================================================

  describe('Standalone Functions', () => {
    describe('executeStep', () => {
      it('should execute step', async () => {
        const result = await executeStep(testStep);
        expect(result.success).toBe(true);
      });
    });

    describe('executeSteps', () => {
      it('should execute multiple steps', async () => {
        const steps = [
          testStep,
          createStep({
            event: 'input',
            bundle: createBundle({ id: 'username', tag: 'input' }),
            value: 'test',
            path: '//*[@id="username"]',
            x: 100,
            y: 200
          })
        ];

        const results = await executeSteps(steps, { delayBetween: 0 });

        expect(results).toHaveLength(2);
        expect(results.every(r => r.success)).toBe(true);
      });

      it('should stop on failure when configured', async () => {
        const { executeStrategy } = await import('../locators');
        vi.mocked(executeStrategy).mockResolvedValueOnce({
          found: false,
          element: null,
          strategy: null,
          confidence: 0,
          duration: 100,
          attempts: [],
          context: null,
          inIframe: false,
          inShadowDom: false,
          matchScore: 0
        });

        const steps = [testStep, testStep];
        const results = await executeSteps(steps, { stopOnFailure: true, delayBetween: 0 });

        expect(results).toHaveLength(1); // Stopped after first failure
      });
    });

    describe('validateStep', () => {
      it('should validate correct step', () => {
        const result = validateStep(testStep);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject null step', () => {
        const result = validateStep(null as any);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should reject missing event', () => {
        const invalid = { ...testStep, event: undefined as any };
        const result = validateStep(invalid);
        expect(result.valid).toBe(false);
      });
    });

    describe('describeStep', () => {
      it('should describe click step', () => {
        const desc = describeStep(testStep);
        expect(desc).toContain('Click');
        expect(desc).toContain('submit-btn');
      });

      it('should describe input step', () => {
        const inputStep = createStep({
          event: 'input',
          bundle: createBundle({ id: 'username', tag: 'input' }),
          value: 'testvalue',
          path: '//*[@id="username"]',
          x: 100,
          y: 200
        });

        const desc = describeStep(inputStep);
        expect(desc).toContain('Enter');
        expect(desc).toContain('testvalue');
      });

      it('should describe open step', () => {
        const openStep = createStep({
          event: 'open',
          bundle: createBundle({ pageUrl: 'http://example.com', tag: 'document' }),
          value: 'http://example.com',
          path: '',
          x: 0,
          y: 0
        });

        const desc = describeStep(openStep);
        expect(desc).toContain('Navigate');
        expect(desc).toContain('http://example.com');
      });

      it('should describe enter step', () => {
        const enterStep = createStep({
          event: 'enter',
          bundle: createBundle({ id: 'username', tag: 'input' }),
          value: '',
          path: '//*[@id="username"]',
          x: 100,
          y: 200
        });

        const desc = describeStep(enterStep);
        expect(desc).toContain('Enter');
      });
    });

    describe('getErrorSummary', () => {
      it('should return null for success', () => {
        const result = { success: true } as any;
        expect(getErrorSummary(result)).toBeNull();
      });

      it('should return error message', async () => {
        const { executeStrategy } = await import('../locators');
        vi.mocked(executeStrategy).mockResolvedValueOnce({
          found: false,
          element: null,
          strategy: null,
          confidence: 0,
          duration: 100,
          attempts: [],
          context: null,
          inIframe: false,
          inShadowDom: false,
          matchScore: 0
        });

        const result = await executeStep(testStep);
        const summary = getErrorSummary(result);

        expect(summary).toContain('element');
      });
    });

    describe('createExecutionReport', () => {
      it('should create report for successful results', async () => {
        const results = await executeSteps([testStep], { delayBetween: 0 });
        const report = createExecutionReport(results);

        expect(report.totalSteps).toBe(1);
        expect(report.passedSteps).toBe(1);
        expect(report.failedSteps).toBe(0);
        expect(report.summary).toContain('passed');
      });

      it('should create report for failed results', async () => {
        const { executeStrategy } = await import('../locators');
        vi.mocked(executeStrategy).mockResolvedValueOnce({
          found: false,
          element: null,
          strategy: null,
          confidence: 0,
          duration: 100,
          attempts: [],
          context: null,
          inIframe: false,
          inShadowDom: false,
          matchScore: 0
        });

        const results = await executeSteps([testStep], { delayBetween: 0 });
        const report = createExecutionReport(results);

        expect(report.failedSteps).toBe(1);
        expect(report.errors.length).toBe(1);
        expect(report.summary).toContain('failed');
      });

      it('should calculate duration stats', async () => {
        const results = await executeSteps([testStep, testStep], { delayBetween: 0 });
        const report = createExecutionReport(results);

        expect(report.totalDuration).toBeGreaterThanOrEqual(0);
        expect(report.averageDuration).toBeGreaterThanOrEqual(0);
      });
    });
  });
});
