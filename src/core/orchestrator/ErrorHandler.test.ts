/**
 * Tests for ErrorHandler
 * @module core/orchestrator/ErrorHandler.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ErrorHandler,
  createErrorHandler,
  createContinueOnErrorHandler,
  createStrictErrorHandler,
  withErrorHandling,
  DEFAULT_ERROR_HANDLER_CONFIG,
  type ExecutionError,
  type ErrorCategory,
  type FailurePolicy,
  type ErrorHandlingResult,
} from './ErrorHandler';

// ============================================================================
// CONSTRUCTOR TESTS
// ============================================================================

describe('ErrorHandler', () => {
  let handler: ErrorHandler;

  beforeEach(() => {
    handler = new ErrorHandler({ logErrors: false });
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      const config = handler.getConfig();
      expect(config.defaultPolicy).toBe('continue');
      expect(config.maxRetries).toBe(2);
    });

    it('should accept custom config', () => {
      const custom = new ErrorHandler({ maxRetries: 5 });
      expect(custom.getConfig().maxRetries).toBe(5);
    });

    it('should start with no errors', () => {
      expect(handler.getErrorCount()).toBe(0);
      expect(handler.hasErrors()).toBe(false);
    });
  });

  // ==========================================================================
  // ERROR HANDLING TESTS
  // ==========================================================================

  describe('handle', () => {
    it('should handle string error', () => {
      const result = handler.handle('Something went wrong');

      expect(result.error).toBeDefined();
      expect(result.error.message).toBe('Something went wrong');
    });

    it('should handle Error object', () => {
      const error = new Error('Test error');
      const result = handler.handle(error);

      expect(result.error.message).toBe('Test error');
      expect(result.error.originalError).toBe(error);
    });

    it('should store error in history', () => {
      handler.handle('Error 1');
      handler.handle('Error 2');

      expect(handler.getErrorCount()).toBe(2);
      expect(handler.getErrors().length).toBe(2);
    });

    it('should assign unique IDs', () => {
      const result1 = handler.handle('Error 1');
      const result2 = handler.handle('Error 2');

      expect(result1.error.id).not.toBe(result2.error.id);
    });

    it('should add timestamp', () => {
      const before = new Date();
      const result = handler.handle('Error');
      const after = new Date();

      expect(result.error.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.error.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  // ==========================================================================
  // ERROR CLASSIFICATION TESTS
  // ==========================================================================

  describe('error classification', () => {
    it('should classify element_not_found', () => {
      const result = handler.handle('Element not found');
      expect(result.error.category).toBe('element_not_found');
    });

    it('should classify timeout', () => {
      const result = handler.handle('Operation timed out');
      expect(result.error.category).toBe('timeout');
    });

    it('should classify navigation errors', () => {
      const result = handler.handle('Navigation failed');
      expect(result.error.category).toBe('navigation');
    });

    it('should classify injection errors', () => {
      const result = handler.handle('Script injection failed');
      expect(result.error.category).toBe('injection');
    });

    it('should classify network errors', () => {
      const result = handler.handle('Network request failed');
      expect(result.error.category).toBe('network');
    });

    it('should default to unknown', () => {
      const result = handler.handle('Some random error');
      expect(result.error.category).toBe('unknown');
    });

    it('should use classifyError method directly', () => {
      expect(handler.classifyError('Element not found')).toBe('element_not_found');
      expect(handler.classifyError('Timeout occurred')).toBe('timeout');
      expect(handler.classifyError('xyz')).toBe('unknown');
    });
  });

  // ==========================================================================
  // POLICY TESTS
  // ==========================================================================

  describe('failure policies', () => {
    it('should continue on element_not_found', () => {
      const result = handler.handle('Element not found');

      expect(result.shouldContinue).toBe(true);
      expect(result.shouldAbort).toBe(false);
    });

    it('should abort on navigation error', () => {
      const result = handler.handle('Navigation failed');

      expect(result.shouldAbort).toBe(true);
      expect(result.shouldContinue).toBe(false);
    });

    it('should retry on timeout', () => {
      const result = handler.handle('Operation timed out');

      expect(result.shouldRetry).toBe(true);
      expect(result.error.retryCount).toBe(1);
    });

    it('should skip on validation error', () => {
      const result = handler.handle('Validation failed');

      expect(result.shouldSkip).toBe(true);
      expect(result.shouldContinue).toBe(true);
    });

    it('should allow custom policy per category', () => {
      handler.setPolicy('element_not_found', 'abort');
      const result = handler.handle('Element not found');

      expect(result.shouldAbort).toBe(true);
    });

    it('should use default policy for unknown categories', () => {
      const result = handler.handle('Unknown error type');

      expect(result.shouldContinue).toBe(true);
    });
  });

  // ==========================================================================
  // RETRY LOGIC TESTS
  // ==========================================================================

  describe('retry logic', () => {
    it('should retry up to maxRetries', () => {
      const result1 = handler.handle('Timeout');
      expect(result1.shouldRetry).toBe(true);
      expect(result1.error.retryCount).toBe(1);

      const result2 = handler.handle('Timeout');
      expect(result2.shouldRetry).toBe(true);
      expect(result2.error.retryCount).toBe(2);

      const result3 = handler.handle('Timeout');
      expect(result3.shouldRetry).toBe(false);
      expect(result3.shouldContinue).toBe(true);
    });

    it('should track retries per step', () => {
      const handler2 = new ErrorHandler();

      // Step 0 retries
      handler2.handle('Timeout', { stepIndex: 0 } as any);
      handler2.handle('Timeout', { stepIndex: 0 } as any);
      handler2.handle('Timeout', { stepIndex: 0 } as any); // Max out retries

      // Step 1 should start fresh
      const result = handler2.handle('Timeout', { stepIndex: 1 } as any);
      expect(result.shouldRetry).toBe(true);
      expect(result.error.retryCount).toBe(1);
    });

    it('should track retries per category', () => {
      // Exhaust retries for timeout at implicit step (undefined)
      handler.handle('Timeout');
      handler.handle('Timeout');
      const result1 = handler.handle('Timeout'); // Max out
      expect(result1.shouldRetry).toBe(false);
      
      // Network errors (also retry policy) start fresh
      const result2 = handler.handle('Network error');
      expect(result2.shouldRetry).toBe(true);
      expect(result2.error.retryCount).toBe(1);
    });
  });

  // ==========================================================================
  // MAX ERRORS TESTS
  // ==========================================================================

  describe('max errors threshold', () => {
    it('should abort when max errors reached', () => {
      const limitedHandler = new ErrorHandler({ maxErrors: 3 });

      limitedHandler.handle('Error 1');
      limitedHandler.handle('Error 2');
      const result = limitedHandler.handle('Error 3');

      expect(result.shouldAbort).toBe(true);
      expect(result.error.severity).toBe('fatal');
    });

    it('should emit fatal event when max reached', () => {
      const limitedHandler = new ErrorHandler({ maxErrors: 2 });
      const listener = vi.fn();
      limitedHandler.onEvent(listener);

      limitedHandler.handle('Error 1');
      limitedHandler.handle('Error 2');

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error_fatal',
        })
      );
    });
  });

  // ==========================================================================
  // RECOVERY STRATEGY TESTS
  // ==========================================================================

  describe('recovery strategies', () => {
    it('should register recovery strategy', () => {
      const strategy = vi.fn().mockResolvedValue({ success: true, action: 'retry' });
      handler.registerRecoveryStrategy('element_not_found', strategy);

      expect(handler.hasRecoveryStrategy('element_not_found')).toBe(true);
    });

    it('should execute recovery strategy', async () => {
      // Use fresh handler to avoid pollution from previous tests
      const recoveryHandler = new ErrorHandler({ logErrors: false });
      const strategy = vi.fn().mockResolvedValue({ success: true, action: 'alternative_locator' });
      recoveryHandler.registerRecoveryStrategy('element_not_found', strategy);

      const result = await recoveryHandler.handleWithRecovery('Element not found');

      // Recovery runs for non-abort policies
      expect(strategy).toHaveBeenCalled();
      expect(result.error.recovered).toBe(true);
      expect(result.error.recoveryAction).toBe('alternative_locator');
      expect(result.shouldContinue).toBe(true);
    });

    it('should handle recovery failure', async () => {
      const strategy = vi.fn().mockRejectedValue(new Error('Recovery failed'));
      handler.registerRecoveryStrategy('element_not_found', strategy);

      const result = await handler.handleWithRecovery('Element not found');

      expect(result.error.recovered).toBe(false);
    });

    it('should remove recovery strategy', () => {
      handler.registerRecoveryStrategy('timeout', async () => ({ success: true, action: 'test' }));
      handler.removeRecoveryStrategy('timeout');

      expect(handler.hasRecoveryStrategy('timeout')).toBe(false);
    });
  });

  // ==========================================================================
  // ERROR QUERIES TESTS
  // ==========================================================================

  describe('error queries', () => {
    // Helper to create fresh handler with test data
    const createTestHandler = () => {
      const h = new ErrorHandler({ logErrors: false });
      h.handle('Element not found', { stepIndex: 0 } as any);
      h.handle('Timeout occurred', { stepIndex: 1 } as any);
      h.handle('Element not found', { stepIndex: 2 } as any);
      h.handle('Navigation failed');
      return h;
    };

    it('should get errors by category', () => {
      const h = createTestHandler();
      const notFound = h.getErrorsByCategory('element_not_found');
      expect(notFound.length).toBe(2);
    });

    it('should get errors by severity', () => {
      const h = createTestHandler();
      const fatal = h.getErrorsBySeverity('fatal');
      expect(fatal.length).toBe(1); // navigation
    });

    it('should get errors for step', () => {
      const h = createTestHandler();
      const step0Errors = h.getStepErrors(0);
      expect(step0Errors.length).toBe(1);
    });

    it('should get fatal errors', () => {
      const h = createTestHandler();
      const fatal = h.getFatalErrors();
      expect(fatal.length).toBe(1);
    });

    it('should check for fatal errors', () => {
      const h = createTestHandler();
      expect(h.hasFatalErrors()).toBe(true);
    });

    it('should get last error', () => {
      const h = createTestHandler();
      const last = h.getLastError();
      expect(last?.category).toBe('navigation');
    });
  });

  // ==========================================================================
  // STATISTICS TESTS
  // ==========================================================================

  describe('statistics', () => {
    beforeEach(() => {
      handler.handle('Element not found');
      handler.handle('Timeout');
      handler.handle('Element not found');
    });

    it('should calculate total', () => {
      const stats = handler.getStats();
      expect(stats.total).toBe(3);
    });

    it('should count by category', () => {
      const stats = handler.getStats();
      expect(stats.byCategory.element_not_found).toBe(2);
      expect(stats.byCategory.timeout).toBe(1);
    });

    it('should track first and last timestamps', () => {
      const stats = handler.getStats();
      expect(stats.firstErrorAt).toBeDefined();
      expect(stats.lastErrorAt).toBeDefined();
    });

    it('should generate summary', () => {
      const summary = handler.getSummary();
      
      expect(summary).toContain('Total Errors: 3');
      expect(summary).toContain('element_not_found');
    });
  });

  // ==========================================================================
  // EVENT HANDLING TESTS
  // ==========================================================================

  describe('events', () => {
    it('should emit error_occurred event', () => {
      const listener = vi.fn();
      handler.onEvent(listener);

      handler.handle('Test error');

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error_occurred',
        })
      );
    });

    it('should emit retry_attempted event', () => {
      const listener = vi.fn();
      handler.onEvent(listener);

      handler.handle('Timeout');

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'retry_attempted',
        })
      );
    });

    it('should unsubscribe listener', () => {
      const listener = vi.fn();
      const unsubscribe = handler.onEvent(listener);

      unsubscribe();
      handler.handle('Test');

      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle listener errors gracefully', () => {
      const badListener = vi.fn(() => { throw new Error('Listener error'); });
      const goodListener = vi.fn();

      handler.onEvent(badListener);
      handler.onEvent(goodListener);

      handler.handle('Test');

      expect(goodListener).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // CONFIGURATION TESTS
  // ==========================================================================

  describe('configuration', () => {
    it('should update config', () => {
      handler.updateConfig({ maxRetries: 10 });
      expect(handler.getConfig().maxRetries).toBe(10);
    });

    it('should set policy for category', () => {
      handler.setPolicy('unknown', 'abort');
      const result = handler.handle('Random error');
      expect(result.shouldAbort).toBe(true);
    });

    it('should reset state', () => {
      handler.handle('Error 1');
      handler.handle('Error 2');
      
      handler.reset();

      expect(handler.getErrorCount()).toBe(0);
    });

    it('should clear errors only', () => {
      handler.handle('Error');
      handler.clearErrors();

      expect(handler.getErrorCount()).toBe(0);
    });
  });

  // ==========================================================================
  // STRICT MODE TESTS
  // ==========================================================================

  describe('strict mode', () => {
    it('should treat validation as error in strict mode', () => {
      const strictHandler = new ErrorHandler({ strictMode: true });
      const result = strictHandler.handle('Validation failed');

      expect(result.error.severity).toBe('error');
    });

    it('should treat validation as warning in normal mode', () => {
      const result = handler.handle('Validation failed');
      expect(result.error.severity).toBe('warning');
    });
  });
});

// ============================================================================
// FACTORY FUNCTION TESTS
// ============================================================================

describe('factory functions', () => {
  describe('createErrorHandler', () => {
    it('should create instance', () => {
      const handler = createErrorHandler({ maxRetries: 5 });
      expect(handler).toBeInstanceOf(ErrorHandler);
      expect(handler.getConfig().maxRetries).toBe(5);
    });
  });

  describe('createContinueOnErrorHandler', () => {
    it('should create handler with continue policy', () => {
      const handler = createContinueOnErrorHandler();
      expect(handler.getConfig().defaultPolicy).toBe('continue');
    });
  });

  describe('createStrictErrorHandler', () => {
    it('should create handler with abort policy', () => {
      const handler = createStrictErrorHandler();
      expect(handler.getConfig().defaultPolicy).toBe('abort');
      expect(handler.getConfig().strictMode).toBe(true);
      expect(handler.getConfig().maxRetries).toBe(0);
    });
  });

  describe('withErrorHandling', () => {
    it('should return result on success', async () => {
      const handler = new ErrorHandler();
      const { result, error } = await withErrorHandling(
        handler,
        async () => 42
      );

      expect(result).toBe(42);
      expect(error).toBeUndefined();
    });

    it('should return error on failure', async () => {
      const handler = new ErrorHandler();
      const { result, error } = await withErrorHandling(
        handler,
        async () => { throw new Error('Failed'); }
      );

      expect(result).toBeUndefined();
      expect(error).toBeDefined();
      expect(error?.error.message).toBe('Failed');
    });
  });
});
