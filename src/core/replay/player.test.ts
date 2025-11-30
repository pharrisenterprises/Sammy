/**
 * @fileoverview Tests for replay player
 * @module core/replay/player.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  Player,
  createPlayer,
  runReplay,
  generateLogFromResults,
  DEFAULT_REPLAY_CONFIG
} from './player';
import { createStep, createBundle } from '../types';
import type { Step, Field } from '../types';

// Mock the locators module
vi.mock('../locators', () => {
  const mockElement = { tagName: 'INPUT', nodeType: 1 };
  return {
    executeStrategy: vi.fn().mockResolvedValue({
      found: true,
      element: mockElement,
      strategy: 'id',
      confidence: 90,
      duration: 50,
      attempts: [],
      context: null,
      inIframe: false,
      inShadowDom: false,
      matchScore: 90
    }),
    performClick: vi.fn().mockResolvedValue(undefined),
    performInput: vi.fn().mockResolvedValue(undefined),
    performEnter: vi.fn().mockResolvedValue(undefined),
    highlightReplay: vi.fn().mockReturnValue('highlight-123'),
    highlightSuccess: vi.fn(),
    highlightError: vi.fn(),
    removeHighlight: vi.fn(),
    clearAllHighlights: vi.fn()
  };
});

describe('Player', () => {
  let dom: JSDOM;
  let document: Document;
  let testSteps: Step[];

  beforeEach(() => {
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <form id="login-form">
            <input id="username" name="username" type="text">
            <input id="password" name="password" type="password">
            <button id="submit-btn" type="submit">Login</button>
          </form>
        </body>
      </html>
    `, { url: 'http://localhost/test' });
    
    document = dom.window.document;
    global.document = document;
    global.window = dom.window as unknown as (Window & typeof globalThis);

    // Create test steps
    testSteps = [
      createStep({
        event: 'open',
        bundle: createBundle({ pageUrl: 'http://localhost/test', tag: 'document' }),
        value: 'http://localhost/test',
        path: '',
        x: 0,
        y: 0
      }),
      createStep({
        event: 'click',
        bundle: createBundle({ id: 'username', tag: 'input' }),
        value: '',
        path: '//*[@id="username"]',
        x: 100,
        y: 200
      }),
      createStep({
        event: 'input',
        bundle: createBundle({ id: 'username', tag: 'input', name: 'username' }),
        value: 'testuser',
        path: '//*[@id="username"]',
        x: 100,
        y: 200
      }),
      createStep({
        event: 'enter',
        bundle: createBundle({ id: 'submit-btn', tag: 'button' }),
        value: '',
        path: '//*[@id="submit-btn"]',
        x: 150,
        y: 300
      })
    ];

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
    it('should have correct default config', () => {
      expect(DEFAULT_REPLAY_CONFIG.stepDelay).toBe(500);
      expect(DEFAULT_REPLAY_CONFIG.elementTimeout).toBe(5000);
      expect(DEFAULT_REPLAY_CONFIG.retryCount).toBe(3);
      expect(DEFAULT_REPLAY_CONFIG.stopOnFailure).toBe(true);
      expect(DEFAULT_REPLAY_CONFIG.showHighlights).toBe(true);
    });
  });

  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================

  describe('Lifecycle', () => {
    describe('play', () => {
      it('should execute all steps', async () => {
        const player = new Player(testSteps, { stepDelay: 0 });
        
        const results = await player.play();

        expect(results).toHaveLength(4);
        expect(results.every(r => r.success)).toBe(true);
      });

      it('should call callbacks', async () => {
        const onStepStart = vi.fn();
        const onStepComplete = vi.fn();
        const onComplete = vi.fn();

        const player = new Player(testSteps, { stepDelay: 0 }, {
          onStepStart,
          onStepComplete,
          onComplete
        });

        await player.play();

        expect(onStepStart).toHaveBeenCalledTimes(4);
        expect(onStepComplete).toHaveBeenCalledTimes(4);
        expect(onComplete).toHaveBeenCalledTimes(1);
      });

      it('should throw if already running', async () => {
        const player = new Player(testSteps, { stepDelay: 100 });
        
        // Start playing
        const playPromise = player.play();

        // Try to play again
        await expect(player.play()).rejects.toThrow('Replay already in progress');

        // Stop to clean up
        player.stop();
        await playPromise;
      });
    });

    describe('stop', () => {
      it('should stop replay', async () => {
        const player = new Player(testSteps, { stepDelay: 100 });
        
        const playPromise = player.play();
        
        // Stop immediately
        player.stop();

        const results = await playPromise;
        
        expect(player.getState()).toBe('stopped');
        expect(results.length).toBeLessThanOrEqual(testSteps.length);
      });
    });

    describe('pause/resume', () => {
      it('should pause and resume', async () => {
        const player = new Player(testSteps, { stepDelay: 50 });
        
        const playPromise = player.play();
        
        // Pause
        player.pause();
        expect(player.isPaused()).toBe(true);
        
        // Resume
        player.resume();
        expect(player.isRunning()).toBe(true);

        await playPromise;
      });
    });

    describe('reset', () => {
      it('should reset player state', async () => {
        const player = new Player(testSteps, { stepDelay: 0 });
        
        await player.play();
        expect(player.getResults().length).toBeGreaterThan(0);

        player.reset();

        expect(player.getResults()).toHaveLength(0);
      });
    });
  });

  // ==========================================================================
  // CSV INJECTION
  // ==========================================================================

  describe('CSV Injection', () => {
    it('should inject CSV values into input steps', async () => {
      const { performInput } = await import('../locators');
      
      const player = new Player(testSteps, { stepDelay: 0 });

      const fields: Field[] = [
        { field_name: 'username', mapped: true, inputvarfields: 'csv_username' }
      ];

      player.setCsvData(
        ['csv_username', 'csv_password'],
        { csv_username: 'csvuser', csv_password: 'csvpass' },
        0,
        fields
      );

      await player.play();

      // Check that performInput was called with CSV value
      expect(performInput).toHaveBeenCalled();
    });

    it('should use original value if no CSV mapping', async () => {
      const player = new Player(testSteps, { stepDelay: 0 });

      // No CSV data set
      const results = await player.play();

      const inputResult = results.find(r => r.step.event === 'input');
      expect(inputResult?.success).toBe(true);
    });

    it('should clear CSV data', () => {
      const player = new Player(testSteps);

      player.setCsvData(
        ['col1'],
        { col1: 'value' },
        0,
        []
      );

      player.clearCsvData();

      // Should not throw and should use original values
    });
  });

  // ==========================================================================
  // STEP EXECUTION
  // ==========================================================================

  describe('Step Execution', () => {
    it('should execute open step', async () => {
      const openStep = createStep({
        event: 'open',
        bundle: createBundle({ pageUrl: 'http://localhost/test', tag: 'document' }),
        value: 'http://localhost/test',
        path: '',
        x: 0,
        y: 0
      });

      const player = new Player([openStep], { stepDelay: 0 });
      const results = await player.play();

      expect(results[0].success).toBe(true);
    });

    it('should execute click step', async () => {
      const clickStep = createStep({
        event: 'click',
        bundle: createBundle({ id: 'submit-btn', tag: 'button' }),
        value: '',
        path: '//*[@id="submit-btn"]',
        x: 150,
        y: 300
      });

      const player = new Player([clickStep], { stepDelay: 0 });
      const results = await player.play();

      expect(results[0].success).toBe(true);
      expect(results[0].locatorStrategy).toBe('id');
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

      const player = new Player([inputStep], { stepDelay: 0 });
      const results = await player.play();

      expect(results[0].success).toBe(true);
    });

    it('should execute enter step', async () => {
      const enterStep = createStep({
        event: 'enter',
        bundle: createBundle({ id: 'username', tag: 'input' }),
        value: '',
        path: '//*[@id="username"]',
        x: 100,
        y: 200
      });

      const player = new Player([enterStep], { stepDelay: 0 });
      const results = await player.play();

      expect(results[0].success).toBe(true);
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

      const clickStep = createStep({
        event: 'click',
        bundle: createBundle({ id: 'nonexistent', tag: 'button' }),
        value: '',
        path: '//*[@id="nonexistent"]',
        x: 0,
        y: 0
      });

      const player = new Player([clickStep], { stepDelay: 0, retryCount: 0 });
      const results = await player.play();

      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('Element not found');
    });
  });

  // ==========================================================================
  // RETRIES
  // ==========================================================================

  describe('Retries', () => {
    it('should retry failed steps', async () => {
      const { executeStrategy } = await import('../locators');
      
      const mockButton = { tagName: 'BUTTON', nodeType: 1 };
      
      // Fail first, succeed second
      vi.mocked(executeStrategy)
        .mockResolvedValueOnce({
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
        })
        .mockResolvedValueOnce({
          found: true,
          element: mockButton as any,
          strategy: 'id',
          confidence: 90,
          duration: 50,
          attempts: [],
          context: null,
          inIframe: false,
          inShadowDom: false,
          matchScore: 95
        });

      const clickStep = createStep({
        event: 'click',
        bundle: createBundle({ id: 'submit', tag: 'button' }),
        value: '',
        path: '//*[@id="submit"]',
        x: 150,
        y: 300
      });

      const player = new Player([clickStep], { stepDelay: 0, retryCount: 2, retryDelay: 0 });
      const results = await player.play();

      expect(results[0].success).toBe(true);
      expect(results[0].retries).toBe(1);
    });
  });

  // ==========================================================================
  // PROGRESS
  // ==========================================================================

  describe('Progress', () => {
    it('should track progress', async () => {
      const onProgress = vi.fn();

      const player = new Player(testSteps, { stepDelay: 0 }, { onProgress });

      await player.play();

      expect(onProgress).toHaveBeenCalled();
      
      const lastProgress = onProgress.mock.calls[onProgress.mock.calls.length - 1][0];
      expect(lastProgress.completedSteps).toBe(4);
      expect(lastProgress.totalSteps).toBe(4);
    });

    it('should provide progress info', async () => {
      const player = new Player(testSteps, { stepDelay: 0 });

      const progress = player.getProgress();

      expect(progress.totalSteps).toBe(4);
      expect(progress.state).toBe('idle');
    });
  });

  // ==========================================================================
  // FACTORY FUNCTIONS
  // ==========================================================================

  describe('Factory Functions', () => {
    describe('createPlayer', () => {
      it('should create player instance', () => {
        const player = createPlayer(testSteps);
        expect(player).toBeInstanceOf(Player);
      });
    });

    describe('runReplay', () => {
      it('should run replay and return results', async () => {
        const result = await runReplay(testSteps, { stepDelay: 0 });

        expect(result.results).toHaveLength(4);
        expect(result.passed).toBe(true);
        expect(result.duration).toBeGreaterThanOrEqual(0);
      });
    });

    describe('generateLogFromResults', () => {
      it('should generate log string', async () => {
        const player = new Player(testSteps, { stepDelay: 0 });
        const results = await player.play();

        const log = generateLogFromResults(results);

        expect(typeof log).toBe('string');
        expect(log).toContain('Replay started');
        expect(log).toContain('Step 1');
        expect(log).toContain('PASS');
      });

      it('should include error info for failed steps', () => {
        const results = [{
          step: testSteps[0],
          success: false,
          error: 'Element not found',
          duration: 100,
          retries: 2
        }];

        const log = generateLogFromResults(results);

        expect(log).toContain('FAIL');
        expect(log).toContain('Element not found');
        expect(log).toContain('Retries: 2');
      });
    });
  });

  // ==========================================================================
  // STATE
  // ==========================================================================

  describe('State', () => {
    it('should report running state', async () => {
      const player = new Player(testSteps, { stepDelay: 50 });
      
      const playPromise = player.play();
      
      expect(player.isRunning()).toBe(true);
      expect(player.getState()).toBe('running');

      player.stop();
      await playPromise;
    });

    it('should report results', async () => {
      const player = new Player(testSteps, { stepDelay: 0 });
      
      await player.play();

      expect(player.getResults()).toHaveLength(4);
    });
  });

  // ==========================================================================
  // CLEANUP
  // ==========================================================================

  describe('Cleanup', () => {
    it('should destroy player', async () => {
      const player = new Player(testSteps, { stepDelay: 50 });
      
      const playPromise = player.play();
      
      // Destroy while running
      player.destroy();

      await playPromise;
      
      expect(player.getState()).toBe('stopped');
    });
  });
});
