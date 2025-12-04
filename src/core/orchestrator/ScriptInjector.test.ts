/**
 * Tests for ScriptInjector
 * @module core/orchestrator/ScriptInjector.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ScriptInjector,
  createScriptInjector,
  createScript,
  createInlineScript,
  DEFAULT_CONTENT_SCRIPT,
  DEFAULT_SCRIPT_INJECTOR_CONFIG,
  type InjectableScript,
  type InjectionResult,
} from './ScriptInjector';

// ============================================================================
// CHROME API MOCKS
// ============================================================================

const mockExecuteScript = vi.fn();
const mockLastError: { message: string } | null = null;

const mockChrome = {
  scripting: {
    executeScript: mockExecuteScript,
  },
  runtime: {
    lastError: mockLastError as { message: string } | null,
  },
};

beforeEach(() => {
  (global as any).chrome = mockChrome;
  mockChrome.runtime.lastError = null;
  mockExecuteScript.mockClear();
});

afterEach(() => {
  delete (global as any).chrome;
});

// Helper to simulate successful injection
function mockSuccessfulInjection() {
  mockExecuteScript.mockImplementation((options, callback) => {
    callback([{ frameId: 0, result: undefined }]);
  });
}

// Helper to simulate failed injection
function mockFailedInjection(errorMessage: string) {
  mockExecuteScript.mockImplementation((options, callback) => {
    mockChrome.runtime.lastError = { message: errorMessage };
    callback(undefined);
    mockChrome.runtime.lastError = null;
  });
}

// ============================================================================
// CONSTRUCTOR TESTS
// ============================================================================

describe('ScriptInjector', () => {
  let injector: ScriptInjector;

  beforeEach(() => {
    injector = new ScriptInjector();
    mockSuccessfulInjection();
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      const config = injector.getConfig();
      expect(config.defaultScript).toBe('js/main.js');
      expect(config.allFrames).toBe(true);
      expect(config.maxRetries).toBe(3);
    });

    it('should accept custom config', () => {
      const custom = new ScriptInjector({ maxRetries: 5 });
      expect(custom.getConfig().maxRetries).toBe(5);
    });
  });

  // ==========================================================================
  // BASIC INJECTION TESTS
  // ==========================================================================

  describe('inject', () => {
    it('should inject default script', async () => {
      const result = await injector.inject(12345);

      expect(result.success).toBe(true);
      expect(result.tabId).toBe(12345);
      expect(result.scriptId).toBe('main');
    });

    it('should call chrome.scripting.executeScript', async () => {
      await injector.inject(12345);

      expect(mockExecuteScript).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.objectContaining({ tabId: 12345 }),
          files: ['js/main.js'],
        }),
        expect.any(Function)
      );
    });

    it('should inject into all frames by default', async () => {
      await injector.inject(12345);

      expect(mockExecuteScript).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.objectContaining({ allFrames: true }),
        }),
        expect.any(Function)
      );
    });

    it('should respect allFrames parameter', async () => {
      await injector.inject(12345, false);

      expect(mockExecuteScript).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.objectContaining({ allFrames: false }),
        }),
        expect.any(Function)
      );
    });

    it('should include duration in result', async () => {
      const result = await injector.inject(12345);
      expect(result.duration).toBeDefined();
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================================================
  // SCRIPT INJECTION TESTS
  // ==========================================================================

  describe('injectScript', () => {
    it('should inject custom script', async () => {
      const script: InjectableScript = { id: 'custom', file: 'js/custom.js' };
      const result = await injector.injectScript(12345, script);

      expect(result.success).toBe(true);
      expect(result.scriptId).toBe('custom');
    });

    it('should handle injection failure', async () => {
      mockFailedInjection('Tab not found');

      const result = await injector.inject(12345);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Tab not found');
    });

    it('should retry on failure', async () => {
      let callCount = 0;
      mockExecuteScript.mockImplementation((options, callback) => {
        callCount++;
        if (callCount < 3) {
          mockChrome.runtime.lastError = { message: 'Temporary error' };
          callback(undefined);
          mockChrome.runtime.lastError = null;
        } else {
          callback([{ frameId: 0 }]);
        }
      });

      const fastInjector = new ScriptInjector({ retryDelay: 10 });
      const result = await fastInjector.inject(12345);

      expect(result.success).toBe(true);
      expect(result.retryCount).toBe(2);
      expect(callCount).toBe(3);
    });

    it('should fail after max retries', async () => {
      mockFailedInjection('Persistent error');

      const fastInjector = new ScriptInjector({ retryDelay: 10, maxRetries: 2 });
      const result = await fastInjector.inject(12345);

      expect(result.success).toBe(false);
      expect(result.retryCount).toBe(2);
    });

    it('should not retry when disabled', async () => {
      mockFailedInjection('Error');

      const result = await injector.injectScript(
        12345,
        DEFAULT_CONTENT_SCRIPT,
        { retry: false }
      );

      expect(result.success).toBe(false);
      expect(mockExecuteScript).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // BATCH INJECTION TESTS
  // ==========================================================================

  describe('injectMultiple', () => {
    it('should inject multiple scripts', async () => {
      const scripts: InjectableScript[] = [
        { id: 'script1', file: 'js/script1.js' },
        { id: 'script2', file: 'js/script2.js' },
      ];

      const result = await injector.injectMultiple(12345, scripts);

      expect(result.success).toBe(true);
      expect(result.total).toBe(2);
      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('should report partial failure', async () => {
      let callCount = 0;
      mockExecuteScript.mockImplementation((options, callback) => {
        callCount++;
        if (callCount === 2) {
          mockChrome.runtime.lastError = { message: 'Failed' };
          callback(undefined);
          mockChrome.runtime.lastError = null;
        } else {
          callback([{ frameId: 0 }]);
        }
      });

      const noRetryInjector = new ScriptInjector({ enableRetry: false });
      const scripts: InjectableScript[] = [
        { id: 'script1', file: 'js/script1.js' },
        { id: 'script2', file: 'js/script2.js' },
        { id: 'script3', file: 'js/script3.js' },
      ];

      const result = await noRetryInjector.injectMultiple(12345, scripts);

      expect(result.success).toBe(false);
      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(1);
    });

    it('should stop on error when configured', async () => {
      let callCount = 0;
      mockExecuteScript.mockImplementation((options, callback) => {
        callCount++;
        if (callCount === 1) {
          mockChrome.runtime.lastError = { message: 'Failed' };
          callback(undefined);
          mockChrome.runtime.lastError = null;
        } else {
          callback([{ frameId: 0 }]);
        }
      });

      const noRetryInjector = new ScriptInjector({ enableRetry: false });
      const scripts: InjectableScript[] = [
        { id: 'script1', file: 'js/script1.js' },
        { id: 'script2', file: 'js/script2.js' },
      ];

      const result = await noRetryInjector.injectMultiple(12345, scripts, {
        stopOnError: true,
      });

      expect(result.total).toBe(2);
      expect(result.results.length).toBe(1);
    });
  });

  describe('injectIntoTabs', () => {
    it('should inject into multiple tabs', async () => {
      const results = await injector.injectIntoTabs([1, 2, 3]);

      expect(results.size).toBe(3);
      expect(results.get(1)?.success).toBe(true);
      expect(results.get(2)?.success).toBe(true);
      expect(results.get(3)?.success).toBe(true);
    });
  });

  // ==========================================================================
  // CODE INJECTION TESTS
  // ==========================================================================

  describe('injectCode', () => {
    it('should inject inline code', async () => {
      const result = await injector.injectCode(
        12345,
        'console.log("Hello");',
        'test-code'
      );

      expect(result.success).toBe(true);
      expect(result.scriptId).toBe('test-code');
    });
  });

  describe('injectFunction', () => {
    it('should inject and execute function', async () => {
      mockExecuteScript.mockImplementation((options, callback) => {
        callback([{ frameId: 0, result: 42 }]);
      });

      const result = await injector.injectFunction(12345, () => 21 * 2);

      expect(result.success).toBe(true);
      expect(result.result).toBe(42);
    });

    it('should pass arguments to function', async () => {
      mockExecuteScript.mockImplementation((options, callback) => {
        // Simulate function execution with args
        callback([{ frameId: 0, result: 15 }]);
      });

      const result = await injector.injectFunction(
        12345,
        (a: number, b: number) => a + b,
        [5, 10]
      );

      expect(result.success).toBe(true);
    });
  });

  // ==========================================================================
  // STATUS TRACKING TESTS
  // ==========================================================================

  describe('status tracking', () => {
    it('should track injection status', async () => {
      await injector.inject(12345);

      expect(injector.isInjected(12345, 'main')).toBe(true);
    });

    it('should return false for non-injected tabs', () => {
      expect(injector.isInjected(99999)).toBe(false);
    });

    it('should get injection status', async () => {
      await injector.inject(12345);

      const status = injector.getStatus(12345, 'main');

      expect(status?.injected).toBe(true);
      expect(status?.injectionCount).toBe(1);
      expect(status?.lastInjectedAt).toBeDefined();
    });

    it('should increment injection count', async () => {
      await injector.inject(12345);
      await injector.inject(12345);

      const status = injector.getStatus(12345);
      expect(status?.injectionCount).toBe(2);
    });

    it('should track failed injections', async () => {
      mockFailedInjection('Error');
      const noRetryInjector = new ScriptInjector({ enableRetry: false });

      await noRetryInjector.inject(12345);

      const status = noRetryInjector.getStatus(12345);
      expect(status?.injected).toBe(false);
      expect(status?.lastError).toBe('Error');
    });

    it('should get all statuses', async () => {
      await injector.inject(1);
      await injector.inject(2);

      const statuses = injector.getAllStatuses();
      expect(statuses.length).toBe(2);
    });

    it('should get injected tabs', async () => {
      await injector.inject(1);
      await injector.inject(2);
      await injector.inject(3);

      const tabs = injector.getInjectedTabs();
      expect(tabs).toEqual([1, 2, 3]);
    });

    it('should mark as not injected', async () => {
      await injector.inject(12345);
      injector.markNotInjected(12345);

      expect(injector.isInjected(12345)).toBe(false);
    });

    it('should clear status for tab', async () => {
      await injector.inject(12345);
      await injector.injectScript(12345, { id: 'other', file: 'other.js' });

      injector.clearStatus(12345);

      expect(injector.getStatus(12345, 'main')).toBeUndefined();
      expect(injector.getStatus(12345, 'other')).toBeUndefined();
    });
  });

  // ==========================================================================
  // VERIFICATION TESTS
  // ==========================================================================

  describe('verification', () => {
    it('should verify injection', async () => {
      mockExecuteScript.mockImplementation((options, callback) => {
        callback([{ frameId: 0, result: true }]);
      });

      const verified = await injector.verifyInjection(12345);
      expect(verified).toBe(true);
    });

    it('should return false for failed verification', async () => {
      mockFailedInjection('Not found');

      const verified = await injector.verifyInjection(12345);
      expect(verified).toBe(false);
    });

    it('should inject and verify', async () => {
      const verifyingInjector = new ScriptInjector({ verifyAfterInject: true });

      mockExecuteScript.mockImplementation((options, callback) => {
        callback([{ frameId: 0, result: true }]);
      });

      const result = await verifyingInjector.injectAndVerify(12345);
      expect(result.success).toBe(true);
    });
  });

  // ==========================================================================
  // EVENT HANDLING TESTS
  // ==========================================================================

  describe('events', () => {
    it('should emit injection_started event', async () => {
      const listener = vi.fn();
      injector.onEvent(listener);

      await injector.inject(12345);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'injection_started',
          tabId: 12345,
          scriptId: 'main',
        })
      );
    });

    it('should emit injection_completed event on success', async () => {
      const listener = vi.fn();
      injector.onEvent(listener);

      await injector.inject(12345);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'injection_completed',
          success: true,
        })
      );
    });

    it('should emit injection_failed event on failure', async () => {
      mockFailedInjection('Error');
      const noRetryInjector = new ScriptInjector({ enableRetry: false });
      const listener = vi.fn();
      noRetryInjector.onEvent(listener);

      await noRetryInjector.inject(12345);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'injection_failed',
          success: false,
        })
      );
    });

    it('should emit injection_retry events', async () => {
      let callCount = 0;
      mockExecuteScript.mockImplementation((options, callback) => {
        callCount++;
        if (callCount < 2) {
          mockChrome.runtime.lastError = { message: 'Temp error' };
          callback(undefined);
          mockChrome.runtime.lastError = null;
        } else {
          callback([{ frameId: 0 }]);
        }
      });

      const fastInjector = new ScriptInjector({ retryDelay: 10 });
      const listener = vi.fn();
      fastInjector.onEvent(listener);

      await fastInjector.inject(12345);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'injection_retry',
          retryCount: 1,
        })
      );
    });

    it('should unsubscribe listener', async () => {
      const listener = vi.fn();
      const unsubscribe = injector.onEvent(listener);

      unsubscribe();
      await injector.inject(12345);

      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle listener errors gracefully', async () => {
      const badListener = vi.fn(() => { throw new Error('Listener error'); });
      const goodListener = vi.fn();

      injector.onEvent(badListener);
      injector.onEvent(goodListener);

      await injector.inject(12345);

      expect(goodListener).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // CONFIGURATION TESTS
  // ==========================================================================

  describe('configuration', () => {
    it('should update config', () => {
      injector.updateConfig({ maxRetries: 10 });
      expect(injector.getConfig().maxRetries).toBe(10);
    });

    it('should reset state', async () => {
      await injector.inject(12345);
      injector.reset();

      expect(injector.getAllStatuses().length).toBe(0);
    });
  });
});

// ============================================================================
// FACTORY FUNCTION TESTS
// ============================================================================

describe('factory functions', () => {
  beforeEach(() => {
    mockSuccessfulInjection();
  });

  describe('createScriptInjector', () => {
    it('should create instance', () => {
      const injector = createScriptInjector({ allFrames: false });
      expect(injector).toBeInstanceOf(ScriptInjector);
      expect(injector.getConfig().allFrames).toBe(false);
    });
  });

  describe('createScript', () => {
    it('should create script definition', () => {
      const script = createScript('test', 'js/test.js');
      expect(script.id).toBe('test');
      expect(script.file).toBe('js/test.js');
    });
  });

  describe('createInlineScript', () => {
    it('should create inline script', () => {
      const script = createInlineScript('inline', 'console.log("hi")');
      expect(script.id).toBe('inline');
      expect(script.code).toBe('console.log("hi")');
    });
  });
});
