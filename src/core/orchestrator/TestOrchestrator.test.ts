/**
 * Tests for TestOrchestrator
 * @module core/orchestrator/TestOrchestrator.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  TestOrchestrator,
  createTestOrchestrator,
  DEFAULT_EXECUTION_OPTIONS,
  type TestConfig,
  type ExecutionStep,
  type FieldMapping,
  type ITabOperations,
  type IStorageOperations,
} from './TestOrchestrator';

// ============================================================================
// MOCK IMPLEMENTATIONS
// ============================================================================

function createMockTabOperations(): ITabOperations {
  return {
    openTab: vi.fn().mockResolvedValue({ success: true, tabId: 12345 }),
    closeTab: vi.fn().mockResolvedValue({ success: true }),
    injectScript: vi.fn().mockResolvedValue({ success: true }),
    sendStepCommand: vi.fn().mockResolvedValue(true),
  };
}

function createMockStorageOperations(): IStorageOperations {
  return {
    saveTestRun: vi.fn().mockResolvedValue(1),
  };
}

function createTestConfig(overrides: Partial<TestConfig> = {}): TestConfig {
  return {
    projectId: 1,
    targetUrl: 'https://example.com',
    steps: [
      { index: 0, label: 'First Name', event: 'input', value: 'John' },
      { index: 1, label: 'Submit', event: 'click' },
    ],
    csvData: [],
    fieldMappings: [],
    ...overrides,
  };
}

// ============================================================================
// CONSTRUCTOR TESTS
// ============================================================================

describe('TestOrchestrator', () => {
  let orchestrator: TestOrchestrator;
  let mockTabOps: ITabOperations;
  let mockStorageOps: IStorageOperations;

  beforeEach(() => {
    mockTabOps = createMockTabOperations();
    mockStorageOps = createMockStorageOperations();
    orchestrator = new TestOrchestrator(mockTabOps, mockStorageOps);
  });

  describe('constructor', () => {
    it('should create instance', () => {
      expect(orchestrator).toBeInstanceOf(TestOrchestrator);
    });

    it('should start in idle status', () => {
      expect(orchestrator.getStatus()).toBe('idle');
    });

    it('should not be running initially', () => {
      expect(orchestrator.isRunning()).toBe(false);
    });
  });

  // ==========================================================================
  // RUN TESTS
  // ==========================================================================

  describe('run', () => {
    it('should execute test and return result', async () => {
      const config = createTestConfig();
      const result = await orchestrator.run(config);

      expect(result.success).toBe(true);
      expect(result.wasStopped).toBe(false);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should open tab with target URL', async () => {
      const config = createTestConfig({ targetUrl: 'https://test.com' });
      await orchestrator.run(config);

      expect(mockTabOps.openTab).toHaveBeenCalledWith('https://test.com');
    });

    it('should inject script after opening tab', async () => {
      const config = createTestConfig();
      await orchestrator.run(config);

      expect(mockTabOps.injectScript).toHaveBeenCalledWith(12345);
    });

    it('should execute all steps', async () => {
      const config = createTestConfig({
        steps: [
          { index: 0, label: 'Step 1', event: 'click' },
          { index: 1, label: 'Step 2', event: 'click' },
          { index: 2, label: 'Step 3', event: 'click' },
        ],
      });

      await orchestrator.run(config);

      expect(mockTabOps.sendStepCommand).toHaveBeenCalledTimes(3);
    });

    it('should save test run to storage', async () => {
      const config = createTestConfig();
      await orchestrator.run(config);

      expect(mockStorageOps.saveTestRun).toHaveBeenCalled();
    });

    it('should close tab after completion', async () => {
      const config = createTestConfig();
      await orchestrator.run(config);

      expect(mockTabOps.closeTab).toHaveBeenCalledWith(12345);
    });

    it('should update status to completed', async () => {
      const config = createTestConfig();
      await orchestrator.run(config);

      expect(orchestrator.getStatus()).toBe('completed');
    });
  });

  // ==========================================================================
  // CSV DATA TESTS
  // ==========================================================================

  describe('CSV data handling', () => {
    it('should execute for each CSV row', async () => {
      const config = createTestConfig({
        steps: [{ index: 0, label: 'Name', event: 'input' }],
        csvData: [
          { Name: 'Alice' },
          { Name: 'Bob' },
          { Name: 'Charlie' },
        ],
      });

      await orchestrator.run(config);

      // 3 rows * 1 step = 3 calls
      expect(mockTabOps.sendStepCommand).toHaveBeenCalledTimes(3);
    });

    it('should inject CSV values into steps', async () => {
      const config = createTestConfig({
        steps: [{ index: 0, label: 'Name', event: 'input', value: '' }],
        csvData: [{ Name: 'TestValue' }],
      });

      await orchestrator.run(config);

      expect(mockTabOps.sendStepCommand).toHaveBeenCalledWith(
        12345,
        expect.objectContaining({ value: 'TestValue' })
      );
    });

    it('should use field mappings for value injection', async () => {
      const config = createTestConfig({
        steps: [{ index: 0, label: 'First Name', event: 'input' }],
        csvData: [{ csv_name: 'MappedValue' }],
        fieldMappings: [
          { fieldName: 'csv_name', inputVarFields: 'First Name', mapped: true },
        ],
      });

      await orchestrator.run(config);

      expect(mockTabOps.sendStepCommand).toHaveBeenCalledWith(
        12345,
        expect.objectContaining({ value: 'MappedValue' })
      );
    });

    it('should skip input steps without CSV value', async () => {
      const config = createTestConfig({
        steps: [
          { index: 0, label: 'Name', event: 'input' },
          { index: 1, label: 'Submit', event: 'click' },
        ],
        csvData: [{ Other: 'Value' }],
      });

      await orchestrator.run(config);

      // First step skipped, second step executed
      expect(mockTabOps.sendStepCommand).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // ERROR HANDLING TESTS
  // ==========================================================================

  describe('error handling', () => {
    it('should handle tab open failure', async () => {
      mockTabOps.openTab = vi.fn().mockResolvedValue({
        success: false,
        error: 'Tab not available',
      });

      const config = createTestConfig();
      const result = await orchestrator.run(config);

      expect(result.success).toBe(false);
    });

    it('should handle step execution failure', async () => {
      mockTabOps.sendStepCommand = vi.fn().mockResolvedValue(false);

      const config = createTestConfig();
      const result = await orchestrator.run(config);

      expect(result.success).toBe(false);
      expect(result.result.failedSteps).toBeGreaterThan(0);
    });

    it('should continue on error by default', async () => {
      mockTabOps.sendStepCommand = vi.fn()
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      const config = createTestConfig({
        steps: [
          { index: 0, label: 'Step 1', event: 'click' },
          { index: 1, label: 'Step 2', event: 'click' },
        ],
      });

      await orchestrator.run(config);

      // Both steps should be attempted
      expect(mockTabOps.sendStepCommand).toHaveBeenCalledTimes(2);
    });
  });

  // ==========================================================================
  // CONTROL TESTS
  // ==========================================================================

  describe('pause/resume', () => {
    it('should pause execution', async () => {
      orchestrator.pause();
      expect(orchestrator.isPaused()).toBe(true);
    });

    it('should resume execution', async () => {
      orchestrator.pause();
      orchestrator.resume();
      expect(orchestrator.isPaused()).toBe(false);
    });
  });

  describe('stop', () => {
    it('should stop execution', async () => {
      // Start execution
      const runPromise = orchestrator.run(createTestConfig({
        steps: Array(10).fill(null).map((_, i) => ({
          index: i,
          label: `Step ${i}`,
          event: 'click' as const,
        })),
        options: { stepDelay: 100 },
      }));

      // Stop after short delay
      await new Promise(resolve => setTimeout(resolve, 50));
      orchestrator.stop();

      const result = await runPromise;

      expect(result.wasStopped).toBe(true);
      expect(orchestrator.getStatus()).toBe('stopped');
    });
  });

  // ==========================================================================
  // EVENT TESTS
  // ==========================================================================

  describe('events', () => {
    it('should emit started event', async () => {
      const listener = vi.fn();
      orchestrator.on('started', listener);

      await orchestrator.run(createTestConfig());

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'started',
        })
      );
    });

    it('should emit completed event', async () => {
      const listener = vi.fn();
      orchestrator.on('completed', listener);

      await orchestrator.run(createTestConfig());

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'completed',
        })
      );
    });

    it('should emit progress events', async () => {
      const listener = vi.fn();
      orchestrator.on('progress', listener);

      await orchestrator.run(createTestConfig({
        steps: [
          { index: 0, label: 'Step 1', event: 'click' },
          { index: 1, label: 'Step 2', event: 'click' },
        ],
      }));

      expect(listener).toHaveBeenCalled();
    });

    it('should emit step events', async () => {
      const startListener = vi.fn();
      const completeListener = vi.fn();
      
      orchestrator.on('step_started', startListener);
      orchestrator.on('step_completed', completeListener);

      await orchestrator.run(createTestConfig());

      expect(startListener).toHaveBeenCalled();
      expect(completeListener).toHaveBeenCalled();
    });

    it('should emit row events', async () => {
      const startListener = vi.fn();
      const completeListener = vi.fn();
      
      orchestrator.on('row_started', startListener);
      orchestrator.on('row_completed', completeListener);

      await orchestrator.run(createTestConfig());

      expect(startListener).toHaveBeenCalled();
      expect(completeListener).toHaveBeenCalled();
    });

    it('should unsubscribe from events', async () => {
      const listener = vi.fn();
      const unsubscribe = orchestrator.on('started', listener);

      unsubscribe();
      await orchestrator.run(createTestConfig());

      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // STATE QUERIES TESTS
  // ==========================================================================

  describe('state queries', () => {
    it('should return progress', async () => {
      await orchestrator.run(createTestConfig());
      expect(orchestrator.getProgress()).toBe(100);
    });

    it('should return logs', async () => {
      await orchestrator.run(createTestConfig());
      const logs = orchestrator.getLogs();
      
      expect(logs.toLowerCase()).toContain('execution');
    });

    it('should return state snapshot', async () => {
      const config = createTestConfig();
      await orchestrator.run(config);
      
      const state = orchestrator.getState();
      
      expect(state.status).toBe('completed');
      expect(state.startTime).toBeDefined();
      expect(state.endTime).toBeDefined();
    });
  });

  // ==========================================================================
  // VALIDATION TESTS
  // ==========================================================================

  describe('validation', () => {
    it('should reject config without projectId', async () => {
      const config = createTestConfig({ projectId: 0 });

      await expect(orchestrator.run(config)).rejects.toThrow('Project ID');
    });

    it('should reject config without targetUrl', async () => {
      const config = createTestConfig({ targetUrl: '' });

      await expect(orchestrator.run(config)).rejects.toThrow('Target URL');
    });

    it('should reject config without steps', async () => {
      const config = createTestConfig({ steps: [] });

      await expect(orchestrator.run(config)).rejects.toThrow('step');
    });
  });
});

// ============================================================================
// FACTORY FUNCTION TESTS
// ============================================================================

describe('createTestOrchestrator', () => {
  it('should create instance', () => {
    const tabOps = createMockTabOperations();
    const orchestrator = createTestOrchestrator(tabOps);
    
    expect(orchestrator).toBeInstanceOf(TestOrchestrator);
  });

  it('should work without storage operations', async () => {
    const tabOps = createMockTabOperations();
    const orchestrator = createTestOrchestrator(tabOps);
    
    const result = await orchestrator.run(createTestConfig());
    
    expect(result.success).toBe(true);
    expect(result.testRun).toBeUndefined();
  });
});
