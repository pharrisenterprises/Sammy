/**
 * Tests for PauseController
 * @module core/orchestrator/PauseController.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  PauseController,
  createPauseController,
  pauseAwareDelay,
  pauseAwareIterator,
  waitWithStopCheck,
  DEFAULT_PAUSE_CONTROLLER_CONFIG,
  type PauseReason,
  type PauseEvent,
} from './PauseController';

// ============================================================================
// CONSTRUCTOR TESTS
// ============================================================================

describe('PauseController', () => {
  let controller: PauseController;

  beforeEach(() => {
    controller = new PauseController();
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      const config = controller.getConfig();
      expect(config.startInStepMode).toBe(false);
      expect(config.pauseOnError).toBe(false);
    });

    it('should accept custom config', () => {
      const custom = new PauseController({ startInStepMode: true });
      expect(custom.isStepMode()).toBe(true);
    });

    it('should start not paused', () => {
      expect(controller.isPaused()).toBe(false);
    });
  });

  // ==========================================================================
  // PAUSE/RESUME TESTS
  // ==========================================================================

  describe('pause', () => {
    it('should set paused state', () => {
      controller.pause();
      expect(controller.isPaused()).toBe(true);
    });

    it('should store pause reason', () => {
      controller.pause('user_requested', 'Test pause');
      expect(controller.getPauseReason()).toBe('user_requested');
    });

    it('should store pause message', () => {
      controller.pause('user_requested', 'Test pause');
      expect(controller.getPauseMessage()).toBe('Test pause');
    });

    it('should increment pause count', () => {
      controller.pause();
      controller.resume();
      controller.pause();
      
      expect(controller.getPauseCount()).toBe(2);
    });

    it('should not double-pause', () => {
      controller.pause();
      controller.pause();
      
      expect(controller.getPauseCount()).toBe(1);
    });

    it('should use default values', () => {
      controller.pause();
      expect(controller.getPauseReason()).toBe('user_requested');
      expect(controller.getPauseMessage()).toBe('Execution paused');
    });
  });

  describe('resume', () => {
    it('should clear paused state', () => {
      controller.pause();
      controller.resume();
      
      expect(controller.isPaused()).toBe(false);
    });

    it('should clear pause reason and message', () => {
      controller.pause('user_requested', 'Test');
      controller.resume();
      
      expect(controller.getPauseReason()).toBeUndefined();
      expect(controller.getPauseMessage()).toBeUndefined();
    });

    it('should do nothing if not paused', () => {
      controller.resume();
      expect(controller.isPaused()).toBe(false);
    });

    it('should accumulate pause duration', async () => {
      controller.pause();
      await new Promise(resolve => setTimeout(resolve, 50));
      controller.resume();
      
      const duration = controller.getTotalPauseDuration();
      expect(duration).toBeGreaterThanOrEqual(50);
    });
  });

  describe('toggle', () => {
    it('should toggle from not paused to paused', () => {
      const result = controller.toggle();
      expect(result).toBe(true);
      expect(controller.isPaused()).toBe(true);
    });

    it('should toggle from paused to not paused', () => {
      controller.pause();
      const result = controller.toggle();
      expect(result).toBe(false);
      expect(controller.isPaused()).toBe(false);
    });
  });

  // ==========================================================================
  // WAIT IF PAUSED TESTS
  // ==========================================================================

  describe('waitIfPaused', () => {
    it('should resolve immediately if not paused', async () => {
      const start = Date.now();
      await controller.waitIfPaused();
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(50);
    });

    it('should block when paused until resume', async () => {
      controller.pause();
      
      let resolved = false;
      const waitPromise = controller.waitIfPaused().then(() => {
        resolved = true;
      });

      // Should not be resolved yet
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(resolved).toBe(false);

      // Resume should unblock
      controller.resume();
      await waitPromise;
      expect(resolved).toBe(true);
    });

    it('should work with shouldWait check', () => {
      expect(controller.shouldWait()).toBe(false);
      
      controller.pause();
      expect(controller.shouldWait()).toBe(true);
      
      controller.resume();
      expect(controller.shouldWait()).toBe(false);
    });
  });

  // ==========================================================================
  // STEP MODE TESTS
  // ==========================================================================

  describe('step mode', () => {
    it('should enable step mode', () => {
      controller.enableStepMode();
      expect(controller.isStepMode()).toBe(true);
    });

    it('should disable step mode', () => {
      controller.enableStepMode();
      controller.disableStepMode();
      expect(controller.isStepMode()).toBe(false);
    });

    it('should toggle step mode', () => {
      expect(controller.toggleStepMode()).toBe(true);
      expect(controller.isStepMode()).toBe(true);
      
      expect(controller.toggleStepMode()).toBe(false);
      expect(controller.isStepMode()).toBe(false);
    });

    it('should block on second waitIfPaused in step mode', async () => {
      controller.enableStepMode();
      
      // First call should pass
      await controller.waitIfPaused();
      
      // Second call should block
      let resolved = false;
      const waitPromise = controller.waitIfPaused().then(() => {
        resolved = true;
      });

      await new Promise(resolve => setTimeout(resolve, 50));
      expect(resolved).toBe(false);

      // Step should unblock
      controller.step();
      await waitPromise;
      expect(resolved).toBe(true);
    });

    it('should unblock all waiters when step mode disabled', async () => {
      controller.enableStepMode();
      await controller.waitIfPaused(); // First call passes
      
      let resolved = false;
      const waitPromise = controller.waitIfPaused().then(() => {
        resolved = true;
      });

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(resolved).toBe(false);

      // Disabling step mode should unblock
      controller.disableStepMode();
      await waitPromise;
      expect(resolved).toBe(true);
    });
  });

  // ==========================================================================
  // STATE TESTS
  // ==========================================================================

  describe('getState', () => {
    it('should return full state', () => {
      controller.pause('breakpoint', 'Test');
      
      const state = controller.getState();
      
      expect(state.isPaused).toBe(true);
      expect(state.pauseReason).toBe('breakpoint');
      expect(state.pausedAt).toBeDefined();
    });

    it('should track step mode in state', () => {
      controller.enableStepMode();
      const state = controller.getState();
      
      expect(state.isStepMode).toBe(true);
    });
  });

  // ==========================================================================
  // ERROR HANDLING TESTS
  // ==========================================================================

  describe('onError', () => {
    it('should pause when pauseOnError is true', () => {
      const pauseOnErrorController = new PauseController({ pauseOnError: true });
      
      pauseOnErrorController.onError(new Error('Test error'));
      
      expect(pauseOnErrorController.isPaused()).toBe(true);
      expect(pauseOnErrorController.getPauseReason()).toBe('error_pause');
    });

    it('should not pause when pauseOnError is false', () => {
      controller.onError(new Error('Test error'));
      expect(controller.isPaused()).toBe(false);
    });

    it('should not double-pause on error', () => {
      const pauseOnErrorController = new PauseController({ pauseOnError: true });
      
      pauseOnErrorController.pause();
      pauseOnErrorController.onError(new Error('Test error'));
      
      expect(pauseOnErrorController.getPauseCount()).toBe(1);
    });
  });

  // ==========================================================================
  // BREAKPOINT TESTS
  // ==========================================================================

  describe('breakpoint', () => {
    it('should pause with breakpoint reason', () => {
      controller.breakpoint('test-bp');
      
      expect(controller.isPaused()).toBe(true);
      expect(controller.getPauseReason()).toBe('breakpoint');
    });

    it('should include breakpoint name in message', () => {
      controller.breakpoint('my-breakpoint');
      
      expect(controller.getPauseMessage()).toContain('my-breakpoint');
    });
  });

  // ==========================================================================
  // STATISTICS TESTS
  // ==========================================================================

  describe('statistics', () => {
    it('should calculate total pause duration', async () => {
      controller.pause();
      await new Promise(resolve => setTimeout(resolve, 50));
      controller.resume();
      
      controller.pause();
      await new Promise(resolve => setTimeout(resolve, 30));
      controller.resume();
      
      const total = controller.getTotalPauseDuration();
      expect(total).toBeGreaterThanOrEqual(80);
    });

    it('should include current pause in total', async () => {
      controller.pause();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Still paused
      const total = controller.getTotalPauseDuration();
      expect(total).toBeGreaterThanOrEqual(50);
    });

    it('should get current pause duration', async () => {
      controller.pause();
      await new Promise(resolve => setTimeout(resolve, 30));
      
      const current = controller.getCurrentPauseDuration();
      expect(current).toBeGreaterThanOrEqual(30);
    });

    it('should return 0 for current duration when not paused', () => {
      expect(controller.getCurrentPauseDuration()).toBe(0);
    });
  });

  // ==========================================================================
  // CALLBACK TESTS
  // ==========================================================================

  describe('callbacks', () => {
    it('should call callback on pause', () => {
      const callback = vi.fn();
      controller.onPause(callback);
      
      controller.pause();
      
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'paused',
          reason: 'user_requested',
        })
      );
    });

    it('should call callback on resume', () => {
      const callback = vi.fn();
      controller.onPause(callback);
      
      controller.pause();
      controller.resume();
      
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'resumed',
        })
      );
    });

    it('should call callback on step in step mode', () => {
      const callback = vi.fn();
      controller.onPause(callback);
      
      controller.enableStepMode();
      controller.step();
      
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'step_executed',
        })
      );
    });

    it('should unsubscribe with returned function', () => {
      const callback = vi.fn();
      const unsubscribe = controller.onPause(callback);
      
      unsubscribe();
      controller.pause();
      
      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle callback errors gracefully', () => {
      const badCallback = vi.fn(() => { throw new Error('Callback error'); });
      const goodCallback = vi.fn();
      
      controller.onPause(badCallback);
      controller.onPause(goodCallback);
      
      controller.pause();
      
      expect(goodCallback).toHaveBeenCalled();
    });

    it('should not call callbacks when emitEvents is false', () => {
      const silentController = new PauseController({ emitEvents: false });
      const callback = vi.fn();
      silentController.onPause(callback);
      
      silentController.pause();
      
      expect(callback).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // CONFIGURATION TESTS
  // ==========================================================================

  describe('configuration', () => {
    it('should update config', () => {
      controller.updateConfig({ logToConsole: true });
      expect(controller.getConfig().logToConsole).toBe(true);
    });

    it('should start in step mode when configured', () => {
      const stepController = new PauseController({ startInStepMode: true });
      expect(stepController.isStepMode()).toBe(true);
    });
  });

  // ==========================================================================
  // RESET TESTS
  // ==========================================================================

  describe('reset', () => {
    it('should resume if paused', () => {
      controller.pause();
      controller.reset();
      
      expect(controller.isPaused()).toBe(false);
    });

    it('should clear statistics', () => {
      controller.pause();
      controller.resume();
      controller.reset();
      
      expect(controller.getPauseCount()).toBe(0);
      expect(controller.getTotalPauseDuration()).toBe(0);
    });

    it('should reset step mode to config default', () => {
      const stepController = new PauseController({ startInStepMode: true });
      stepController.disableStepMode();
      stepController.reset();
      
      expect(stepController.isStepMode()).toBe(true);
    });
  });
});

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================

describe('utility functions', () => {
  describe('createPauseController', () => {
    it('should create instance', () => {
      const controller = createPauseController({ logToConsole: true });
      expect(controller).toBeInstanceOf(PauseController);
    });
  });

  describe('pauseAwareIterator', () => {
    it('should yield all items when not paused', async () => {
      const controller = new PauseController();
      const items = [1, 2, 3];
      const result: number[] = [];

      for await (const item of pauseAwareIterator(controller, items)) {
        result.push(item);
      }

      expect(result).toEqual([1, 2, 3]);
    });

    it('should wait when paused', async () => {
      const controller = new PauseController();
      const items = [1, 2, 3];
      const result: number[] = [];

      const iteratorPromise = (async () => {
        for await (const item of pauseAwareIterator(controller, items)) {
          result.push(item);
          if (item === 2) {
            controller.pause();
          }
        }
      })();

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Should have processed 1 and 2, then paused
      expect(result).toEqual([1, 2]);

      // Resume
      controller.resume();
      await iteratorPromise;
      
      expect(result).toEqual([1, 2, 3]);
    });
  });

  describe('waitWithStopCheck', () => {
    it('should pass when not paused and not stopped', async () => {
      const pauseController = new PauseController();
      const stopController = { shouldStop: () => false };

      await expect(
        waitWithStopCheck(pauseController, stopController)
      ).resolves.toBeUndefined();
    });

    it('should throw when stopped', async () => {
      const pauseController = new PauseController();
      const stopController = {
        shouldStop: () => true,
        getStopReason: () => 'user_requested',
      };

      await expect(
        waitWithStopCheck(pauseController, stopController)
      ).rejects.toThrow('stopped');
    });

    it('should wait when paused then check stop', async () => {
      const pauseController = new PauseController();
      let stopped = false;
      const stopController = {
        shouldStop: () => stopped,
        getStopReason: () => 'user_requested',
      };

      pauseController.pause();

      const checkPromise = waitWithStopCheck(pauseController, stopController);

      // Set stop while paused
      stopped = true;

      // Resume - should check stop after resume
      pauseController.resume();

      await expect(checkPromise).rejects.toThrow('stopped');
    });
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('integration scenarios', () => {
  it('should handle pause during step execution', async () => {
    const controller = new PauseController();
    const steps = ['step1', 'step2', 'step3', 'step4'];
    const executed: string[] = [];

    const executionPromise = (async () => {
      for (const step of steps) {
        await controller.waitIfPaused();
        executed.push(step);
        
        // Pause after step2
        if (step === 'step2') {
          // Simulate external pause
          setTimeout(() => controller.pause(), 0);
        }
      }
    })();

    // Wait for execution to pause
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Should have executed step1 and step2
    expect(executed).toContain('step1');
    expect(executed).toContain('step2');

    // Resume
    controller.resume();
    await executionPromise;

    // All steps should be executed
    expect(executed).toEqual(['step1', 'step2', 'step3', 'step4']);
  });

  it('should work in step-by-step mode', async () => {
    const controller = new PauseController({ startInStepMode: true });
    const steps = ['a', 'b', 'c'];
    const executed: string[] = [];

    const executionPromise = (async () => {
      for (const step of steps) {
        await controller.waitIfPaused();
        executed.push(step);
      }
    })();

    // First step executes immediately
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(executed).toEqual(['a']);

    // Need to call step() for each subsequent step
    controller.step();
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(executed).toEqual(['a', 'b']);

    controller.step();
    await executionPromise;
    expect(executed).toEqual(['a', 'b', 'c']);
  });
});
