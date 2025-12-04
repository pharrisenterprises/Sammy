/**
 * Tests for StopController
 * @module core/orchestrator/StopController.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  StopController,
  StopRequestedError,
  isStopRequestedError,
  createStopController,
  withStopControl,
  cancellableDelay,
  stoppableIterator,
  DEFAULT_STOP_CONTROLLER_CONFIG,
  type StopReason,
  type StopEvent,
} from './StopController';

// ============================================================================
// CONSTRUCTOR TESTS
// ============================================================================

describe('StopController', () => {
  let controller: StopController;

  beforeEach(() => {
    controller = new StopController();
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      const config = controller.getConfig();
      expect(config.autoResetOnStart).toBe(true);
      expect(config.emitEvents).toBe(true);
    });

    it('should accept custom config', () => {
      const custom = new StopController({ logToConsole: true });
      expect(custom.getConfig().logToConsole).toBe(true);
    });

    it('should start in stopped state', () => {
      expect(controller.isRunning()).toBe(false);
      expect(controller.shouldStop()).toBe(true);
    });
  });

  // ==========================================================================
  // START/STOP TESTS
  // ==========================================================================

  describe('start', () => {
    it('should mark as running', () => {
      controller.start();
      expect(controller.isRunning()).toBe(true);
    });

    it('should clear stop requested flag', () => {
      controller.start();
      controller.stop();
      controller.start();
      
      expect(controller.shouldStop()).toBe(false);
    });

    it('should set start time', () => {
      const before = new Date();
      controller.start();
      const after = new Date();
      
      const startedAt = controller.getStartedAt();
      expect(startedAt).toBeDefined();
      expect(startedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(startedAt!.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should create new AbortController', () => {
      controller.start();
      expect(controller.getAbortSignal()).toBeDefined();
    });

    it('should reset previous state when autoResetOnStart is true', () => {
      controller.start();
      controller.stop('user_requested', 'Test');
      controller.start();
      
      expect(controller.getStopReason()).toBeUndefined();
      expect(controller.getStopMessage()).toBeUndefined();
    });
  });

  describe('stop', () => {
    beforeEach(() => {
      controller.start();
    });

    it('should mark as not running', () => {
      controller.stop();
      expect(controller.isRunning()).toBe(false);
    });

    it('should set stop requested flag', () => {
      controller.stop();
      expect(controller.shouldStop()).toBe(true);
    });

    it('should store stop reason', () => {
      controller.stop('user_requested', 'User clicked stop');
      expect(controller.getStopReason()).toBe('user_requested');
    });

    it('should store stop message', () => {
      controller.stop('user_requested', 'User clicked stop');
      expect(controller.getStopMessage()).toBe('User clicked stop');
    });

    it('should set stop time', () => {
      controller.stop();
      expect(controller.getStoppedAt()).toBeDefined();
    });

    it('should abort AbortController', () => {
      const signal = controller.getAbortSignal();
      controller.stop();
      expect(signal?.aborted).toBe(true);
    });

    it('should use default values', () => {
      controller.stop();
      expect(controller.getStopReason()).toBe('user_requested');
      expect(controller.getStopMessage()).toBe('Execution stopped');
    });
  });

  describe('complete', () => {
    beforeEach(() => {
      controller.start();
    });

    it('should mark as not running', () => {
      controller.complete();
      expect(controller.isRunning()).toBe(false);
    });

    it('should set reason to completed', () => {
      controller.complete();
      expect(controller.getStopReason()).toBe('completed');
    });

    it('should set completed message', () => {
      controller.complete();
      expect(controller.getStopMessage()).toContain('completed');
    });

    it('should indicate was completed', () => {
      controller.complete();
      expect(controller.wasCompleted()).toBe(true);
      expect(controller.wasStopped()).toBe(false);
    });
  });

  describe('reset', () => {
    it('should clear all state', () => {
      controller.start();
      controller.stop('user_requested', 'Test');
      controller.reset();
      
      expect(controller.isRunning()).toBe(false);
      expect(controller.shouldStop()).toBe(true);
      expect(controller.getStopReason()).toBeUndefined();
      expect(controller.getStartedAt()).toBeUndefined();
    });
  });

  // ==========================================================================
  // STATE CHECK TESTS
  // ==========================================================================

  describe('state checks', () => {
    describe('isRunning', () => {
      it('should return false initially', () => {
        expect(controller.isRunning()).toBe(false);
      });

      it('should return true after start', () => {
        controller.start();
        expect(controller.isRunning()).toBe(true);
      });

      it('should return false after stop', () => {
        controller.start();
        controller.stop();
        expect(controller.isRunning()).toBe(false);
      });
    });

    describe('shouldStop', () => {
      it('should return true initially', () => {
        expect(controller.shouldStop()).toBe(true);
      });

      it('should return false when running', () => {
        controller.start();
        expect(controller.shouldStop()).toBe(false);
      });

      it('should return true when stop requested', () => {
        controller.start();
        controller.stop();
        expect(controller.shouldStop()).toBe(true);
      });
    });

    describe('shouldContinue', () => {
      it('should be inverse of shouldStop', () => {
        expect(controller.shouldContinue()).toBe(false);
        
        controller.start();
        expect(controller.shouldContinue()).toBe(true);
        
        controller.stop();
        expect(controller.shouldContinue()).toBe(false);
      });
    });

    describe('wasStopped', () => {
      it('should return false for completed execution', () => {
        controller.start();
        controller.complete();
        expect(controller.wasStopped()).toBe(false);
      });

      it('should return true for stopped execution', () => {
        controller.start();
        controller.stop('user_requested');
        expect(controller.wasStopped()).toBe(true);
      });
    });

    describe('getState', () => {
      it('should return full state object', () => {
        controller.start();
        const state = controller.getState();
        
        expect(state.isRunning).toBe(true);
        expect(state.stopRequested).toBe(false);
        expect(state.startedAt).toBeDefined();
      });
    });
  });

  // ==========================================================================
  // ABORT SIGNAL TESTS
  // ==========================================================================

  describe('abort signal', () => {
    it('should return undefined before start', () => {
      expect(controller.getAbortSignal()).toBeUndefined();
    });

    it('should return signal after start', () => {
      controller.start();
      expect(controller.getAbortSignal()).toBeDefined();
    });

    it('should not be aborted initially', () => {
      controller.start();
      expect(controller.isAborted()).toBe(false);
    });

    it('should be aborted after stop', () => {
      controller.start();
      controller.stop();
      expect(controller.isAborted()).toBe(true);
    });

    it('should create abort promise', () => {
      controller.start();
      const promise = controller.createAbortPromise();
      expect(promise).toBeInstanceOf(Promise);
    });
  });

  // ==========================================================================
  // CHECKPOINT TESTS
  // ==========================================================================

  describe('checkpoint', () => {
    it('should not throw when running', () => {
      controller.start();
      expect(() => controller.checkpoint()).not.toThrow();
    });

    it('should throw StopRequestedError when stopped', () => {
      controller.start();
      controller.stop('user_requested', 'Test stop');
      
      expect(() => controller.checkpoint()).toThrow(StopRequestedError);
    });

    it('should include stop reason in error', () => {
      controller.start();
      controller.stop('max_errors', 'Too many errors');
      
      try {
        controller.checkpoint();
      } catch (error) {
        expect(isStopRequestedError(error)).toBe(true);
        expect((error as StopRequestedError).reason).toBe('max_errors');
      }
    });
  });

  describe('checkpointSafe', () => {
    it('should return false when running', () => {
      controller.start();
      expect(controller.checkpointSafe()).toBe(false);
    });

    it('should return true when stopped', () => {
      controller.start();
      controller.stop();
      expect(controller.checkpointSafe()).toBe(true);
    });
  });

  describe('assertRunning', () => {
    it('should not throw when running', () => {
      controller.start();
      expect(() => controller.assertRunning()).not.toThrow();
    });

    it('should throw when not running', () => {
      expect(() => controller.assertRunning()).toThrow('not running');
    });
  });

  // ==========================================================================
  // CALLBACK TESTS
  // ==========================================================================

  describe('callbacks', () => {
    it('should call callback on stop', () => {
      const callback = vi.fn();
      controller.onStop(callback);
      
      controller.start();
      controller.stop('user_requested', 'Test');
      
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: 'user_requested',
          message: 'Test',
        })
      );
    });

    it('should unsubscribe with returned function', () => {
      const callback = vi.fn();
      const unsubscribe = controller.onStop(callback);
      
      unsubscribe();
      controller.start();
      controller.stop();
      
      expect(callback).not.toHaveBeenCalled();
    });

    it('should unsubscribe with offStop', () => {
      const callback = vi.fn();
      controller.onStop(callback);
      controller.offStop(callback);
      
      controller.start();
      controller.stop();
      
      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle callback errors gracefully', () => {
      const badCallback = vi.fn(() => { throw new Error('Callback error'); });
      const goodCallback = vi.fn();
      
      controller.onStop(badCallback);
      controller.onStop(goodCallback);
      
      controller.start();
      controller.stop();
      
      expect(goodCallback).toHaveBeenCalled();
    });

    it('should not call callback when emitEvents is false', () => {
      const silentController = new StopController({ emitEvents: false });
      const callback = vi.fn();
      silentController.onStop(callback);
      
      silentController.start();
      silentController.stop();
      
      expect(callback).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // TIMING TESTS
  // ==========================================================================

  describe('timing', () => {
    it('should calculate duration', async () => {
      controller.start();
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 50));
      
      controller.stop();
      
      const duration = controller.getDuration();
      expect(duration).toBeGreaterThanOrEqual(50);
    });

    it('should return 0 duration if never started', () => {
      expect(controller.getDuration()).toBe(0);
    });

    it('should calculate ongoing duration', async () => {
      controller.start();
      
      await new Promise(resolve => setTimeout(resolve, 20));
      
      const duration = controller.getDuration();
      expect(duration).toBeGreaterThanOrEqual(20);
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
  });
});

// ============================================================================
// STOP REQUESTED ERROR TESTS
// ============================================================================

describe('StopRequestedError', () => {
  it('should have correct name', () => {
    const error = new StopRequestedError('user_requested', 'Test');
    expect(error.name).toBe('StopRequestedError');
  });

  it('should include reason', () => {
    const error = new StopRequestedError('max_errors', 'Test');
    expect(error.reason).toBe('max_errors');
  });

  it('should include message', () => {
    const error = new StopRequestedError('user_requested', 'User stopped');
    expect(error.stopMessage).toBe('User stopped');
  });

  it('should be identifiable with isStopRequestedError', () => {
    const error = new StopRequestedError('user_requested', 'Test');
    expect(isStopRequestedError(error)).toBe(true);
    expect(isStopRequestedError(new Error('Other'))).toBe(false);
  });
});

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================

describe('utility functions', () => {
  describe('createStopController', () => {
    it('should create instance', () => {
      const controller = createStopController({ logToConsole: true });
      expect(controller).toBeInstanceOf(StopController);
    });
  });

  describe('withStopControl', () => {
    it('should run function and complete', async () => {
      const controller = new StopController();
      
      const result = await withStopControl(controller, async () => {
        return 42;
      });
      
      expect(result).toBe(42);
      expect(controller.wasCompleted()).toBe(true);
    });

    it('should stop on error', async () => {
      const controller = new StopController();
      
      await expect(withStopControl(controller, async () => {
        throw new Error('Test error');
      })).rejects.toThrow('Test error');
      
      expect(controller.getStopReason()).toBe('fatal_error');
    });
  });

  describe('cancellableDelay', () => {
    it('should resolve after delay', async () => {
      const controller = new StopController();
      controller.start();
      
      const start = Date.now();
      await cancellableDelay(controller, 50);
      const duration = Date.now() - start;
      
      expect(duration).toBeGreaterThanOrEqual(50);
    });

    it('should reject when stopped', async () => {
      const controller = new StopController();
      controller.start();
      
      const delayPromise = cancellableDelay(controller, 1000);
      controller.stop();
      
      await expect(delayPromise).rejects.toThrow();
    });
  });

  describe('stoppableIterator', () => {
    it('should yield all items when not stopped', () => {
      const controller = new StopController();
      controller.start();
      
      const items = [1, 2, 3, 4, 5];
      const result = [...stoppableIterator(controller, items)];
      
      expect(result).toEqual([1, 2, 3, 4, 5]);
    });

    it('should stop yielding when stopped', () => {
      const controller = new StopController();
      controller.start();
      
      const items = [1, 2, 3, 4, 5];
      const result: number[] = [];
      
      for (const item of stoppableIterator(controller, items)) {
        result.push(item);
        if (item === 3) {
          controller.stop();
        }
      }
      
      expect(result).toEqual([1, 2, 3]);
    });
  });
});

// ============================================================================
// SYNCHRONOUS BEHAVIOR TESTS (CRITICAL)
// ============================================================================

describe('synchronous behavior (critical)', () => {
  it('should stop immediately (not async)', () => {
    const controller = new StopController();
    controller.start();
    
    // This must be synchronous - no await needed
    controller.stop();
    
    // Check immediately - should already be stopped
    expect(controller.isRunning()).toBe(false);
    expect(controller.shouldStop()).toBe(true);
  });

  it('should be checkable in tight loop', () => {
    const controller = new StopController();
    controller.start();
    
    let iterations = 0;
    
    // Simulate execution loop
    while (controller.isRunning() && iterations < 100) {
      iterations++;
      
      // Stop at iteration 50
      if (iterations === 50) {
        controller.stop();
      }
    }
    
    // Should have stopped at exactly 50
    expect(iterations).toBe(50);
  });

  it('should work with shouldContinue pattern', () => {
    const controller = new StopController();
    controller.start();
    
    const processed: number[] = [];
    const items = [1, 2, 3, 4, 5];
    
    for (const item of items) {
      if (!controller.shouldContinue()) break;
      
      processed.push(item);
      
      if (item === 3) {
        controller.stop();
      }
    }
    
    expect(processed).toEqual([1, 2, 3]);
  });
});
