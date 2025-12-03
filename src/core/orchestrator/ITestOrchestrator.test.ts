/**
 * Tests for ITestOrchestrator types and constants
 * @module core/orchestrator/ITestOrchestrator.test
 */

import { describe, it, expect } from 'vitest';
import {
  ORCHESTRATOR_TRANSITIONS,
  DEFAULT_ORCHESTRATOR_CONFIG,
  type OrchestratorLifecycle,
  type OrchestratorConfig,
  type OrchestratorProgress,
  type LogLevel,
  type LogEntry,
  type TabInfo,
  type StepStatus,
} from './ITestOrchestrator';

// ============================================================================
// LIFECYCLE TRANSITION TESTS
// ============================================================================

describe('ORCHESTRATOR_TRANSITIONS', () => {
  it('should allow idle → loading', () => {
    expect(ORCHESTRATOR_TRANSITIONS.idle).toContain('loading');
  });
  
  it('should allow loading → ready or error', () => {
    expect(ORCHESTRATOR_TRANSITIONS.loading).toContain('ready');
    expect(ORCHESTRATOR_TRANSITIONS.loading).toContain('error');
  });
  
  it('should allow ready → running or idle', () => {
    expect(ORCHESTRATOR_TRANSITIONS.ready).toContain('running');
    expect(ORCHESTRATOR_TRANSITIONS.ready).toContain('idle');
  });
  
  it('should allow running → paused, stopping, completed, error', () => {
    expect(ORCHESTRATOR_TRANSITIONS.running).toContain('paused');
    expect(ORCHESTRATOR_TRANSITIONS.running).toContain('stopping');
    expect(ORCHESTRATOR_TRANSITIONS.running).toContain('completed');
    expect(ORCHESTRATOR_TRANSITIONS.running).toContain('error');
  });
  
  it('should allow paused → running or stopping', () => {
    expect(ORCHESTRATOR_TRANSITIONS.paused).toContain('running');
    expect(ORCHESTRATOR_TRANSITIONS.paused).toContain('stopping');
  });
  
  it('should allow stopping → stopped', () => {
    expect(ORCHESTRATOR_TRANSITIONS.stopping).toContain('stopped');
  });
  
  it('should allow terminal states → idle', () => {
    expect(ORCHESTRATOR_TRANSITIONS.stopped).toContain('idle');
    expect(ORCHESTRATOR_TRANSITIONS.completed).toContain('idle');
    expect(ORCHESTRATOR_TRANSITIONS.error).toContain('idle');
  });
  
  it('should define transitions for all states', () => {
    const allStates: OrchestratorLifecycle[] = [
      'idle', 'loading', 'ready', 'running', 'paused',
      'stopping', 'stopped', 'completed', 'error',
    ];
    
    for (const state of allStates) {
      expect(ORCHESTRATOR_TRANSITIONS[state]).toBeDefined();
      expect(Array.isArray(ORCHESTRATOR_TRANSITIONS[state])).toBe(true);
    }
  });
});

// ============================================================================
// DEFAULT CONFIG TESTS
// ============================================================================

describe('DEFAULT_ORCHESTRATOR_CONFIG', () => {
  it('should have correct row delay', () => {
    expect(DEFAULT_ORCHESTRATOR_CONFIG.rowDelay).toBe(1000);
  });
  
  it('should have correct step delay', () => {
    expect(DEFAULT_ORCHESTRATOR_CONFIG.stepDelay).toBe(0);
  });
  
  it('should have human delay range', () => {
    expect(DEFAULT_ORCHESTRATOR_CONFIG.humanDelay).toEqual([50, 300]);
  });
  
  it('should continue on row failure by default', () => {
    expect(DEFAULT_ORCHESTRATOR_CONFIG.continueOnRowFailure).toBe(true);
  });
  
  it('should have unlimited max row failures by default', () => {
    expect(DEFAULT_ORCHESTRATOR_CONFIG.maxRowFailures).toBe(0);
  });
  
  it('should have 30s step timeout', () => {
    expect(DEFAULT_ORCHESTRATOR_CONFIG.stepTimeout).toBe(30000);
  });
  
  it('should not capture screenshots by default', () => {
    expect(DEFAULT_ORCHESTRATOR_CONFIG.captureScreenshots).toBe(false);
  });
  
  it('should persist results by default', () => {
    expect(DEFAULT_ORCHESTRATOR_CONFIG.persistResults).toBe(true);
  });
  
  it('should not close tab on complete by default', () => {
    expect(DEFAULT_ORCHESTRATOR_CONFIG.closeTabOnComplete).toBe(false);
  });
  
  it('should not reuse tab by default', () => {
    expect(DEFAULT_ORCHESTRATOR_CONFIG.reuseTab).toBe(false);
  });
});

// ============================================================================
// TYPE VALIDATION TESTS
// ============================================================================

describe('type definitions', () => {
  describe('OrchestratorLifecycle', () => {
    it('should accept valid lifecycle values', () => {
      const validStates: OrchestratorLifecycle[] = [
        'idle', 'loading', 'ready', 'running', 'paused',
        'stopping', 'stopped', 'completed', 'error',
      ];
      
      for (const state of validStates) {
        const lifecycle: OrchestratorLifecycle = state;
        expect(lifecycle).toBe(state);
      }
    });
  });
  
  describe('LogLevel', () => {
    it('should accept valid log levels', () => {
      const validLevels: LogLevel[] = ['info', 'success', 'warning', 'error', 'debug'];
      
      for (const level of validLevels) {
        const logLevel: LogLevel = level;
        expect(logLevel).toBe(level);
      }
    });
  });
  
  describe('LogEntry', () => {
    it('should have required properties', () => {
      const entry: LogEntry = {
        timestamp: '2025-01-01T00:00:00.000Z',
        level: 'info',
        message: 'Test message',
      };
      
      expect(entry.timestamp).toBeDefined();
      expect(entry.level).toBeDefined();
      expect(entry.message).toBeDefined();
    });
    
    it('should accept optional data', () => {
      const entry: LogEntry = {
        timestamp: '2025-01-01T00:00:00.000Z',
        level: 'error',
        message: 'Error occurred',
        data: { stepIndex: 5, error: 'Element not found' },
      };
      
      expect(entry.data).toBeDefined();
      expect(entry.data?.stepIndex).toBe(5);
    });
  });
  
  describe('TabInfo', () => {
    it('should have required properties', () => {
      const tab: TabInfo = {
        tabId: 123,
        url: 'https://example.com',
        scriptInjected: true,
        createdAt: Date.now(),
      };
      
      expect(tab.tabId).toBe(123);
      expect(tab.url).toBe('https://example.com');
      expect(tab.scriptInjected).toBe(true);
      expect(tab.createdAt).toBeGreaterThan(0);
    });
  });
  
  describe('OrchestratorProgress', () => {
    it('should have all progress fields', () => {
      const progress: OrchestratorProgress = {
        lifecycle: 'running',
        currentRow: 2,
        totalRows: 10,
        currentStep: 3,
        totalSteps: 5,
        rowPercentage: 20,
        overallPercentage: 46,
        passedRows: 2,
        failedRows: 0,
        skippedRows: 0,
        elapsedTime: 5000,
        estimatedRemaining: 10000,
      };
      
      expect(progress.lifecycle).toBe('running');
      expect(progress.currentRow).toBe(2);
      expect(progress.totalRows).toBe(10);
      expect(progress.overallPercentage).toBe(46);
    });
  });
  
  describe('StepStatus', () => {
    it('should have required properties', () => {
      const status: StepStatus = {
        index: 0,
        name: 'Click Submit',
        event: 'click',
        status: 'passed',
        duration: 150,
      };
      
      expect(status.index).toBe(0);
      expect(status.name).toBe('Click Submit');
      expect(status.status).toBe('passed');
    });
    
    it('should accept optional error message', () => {
      const status: StepStatus = {
        index: 1,
        name: 'Enter Email',
        event: 'input',
        status: 'failed',
        duration: 2000,
        errorMessage: 'Element not found',
      };
      
      expect(status.errorMessage).toBe('Element not found');
    });
  });
  
  describe('OrchestratorConfig', () => {
    it('should require projectId', () => {
      const config: OrchestratorConfig = {
        projectId: 42,
      };
      
      expect(config.projectId).toBe(42);
    });
    
    it('should accept all optional properties', () => {
      const config: OrchestratorConfig = {
        projectId: 42,
        rowIndices: [0, 2, 4],
        closeTabOnComplete: true,
        reuseTab: true,
        existingTabId: 123,
        rowDelay: 2000,
        stepDelay: 100,
        humanDelay: [100, 500],
        continueOnRowFailure: false,
        maxRowFailures: 3,
        stepTimeout: 60000,
        captureScreenshots: true,
        persistResults: false,
      };
      
      expect(config.rowIndices).toEqual([0, 2, 4]);
      expect(config.closeTabOnComplete).toBe(true);
      expect(config.maxRowFailures).toBe(3);
    });
  });
});

// ============================================================================
// HELPER FUNCTION TESTS
// ============================================================================

describe('helper validation', () => {
  it('should validate state transition', () => {
    function isValidTransition(
      from: OrchestratorLifecycle,
      to: OrchestratorLifecycle
    ): boolean {
      return ORCHESTRATOR_TRANSITIONS[from].includes(to);
    }
    
    expect(isValidTransition('idle', 'loading')).toBe(true);
    expect(isValidTransition('idle', 'running')).toBe(false);
    expect(isValidTransition('running', 'paused')).toBe(true);
    expect(isValidTransition('paused', 'completed')).toBe(false);
  });
  
  it('should calculate progress percentage', () => {
    function calculateProgress(
      currentRow: number,
      totalRows: number,
      currentStep: number,
      totalSteps: number
    ): number {
      const totalOps = totalRows * totalSteps;
      const completedOps = (currentRow * totalSteps) + currentStep;
      return totalOps > 0 ? (completedOps / totalOps) * 100 : 0;
    }
    
    // Row 0, Step 0 of 10 rows × 5 steps = 0%
    expect(calculateProgress(0, 10, 0, 5)).toBe(0);
    
    // Row 5, Step 0 of 10 rows × 5 steps = 50%
    expect(calculateProgress(5, 10, 0, 5)).toBe(50);
    
    // Row 5, Step 2 of 10 rows × 5 steps = 54%
    expect(calculateProgress(5, 10, 2, 5)).toBe(54);
    
    // Row 10, Step 0 of 10 rows × 5 steps = 100%
    expect(calculateProgress(10, 10, 0, 5)).toBe(100);
  });
});
