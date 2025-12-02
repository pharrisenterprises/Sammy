/**
 * Tests for ReplayState
 * @module core/replay/ReplayState.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ReplayStateManager,
  createReplayStateManager,
  getReplayStateManager,
  resetReplayStateManager,
  formatElapsedTime,
  formatEta,
  getLifecycleDisplayName,
  getLifecycleColor,
  isValidTransition,
  createEmptyProgress,
  createEmptyTiming,
  createEmptySnapshot,
  VALID_TRANSITIONS,
  type ReplayLifecycle,
  type StateChangeEvent,
  type ExecutionResult,
} from './ReplayState';

// ============================================================================
// TEST HELPERS
// ============================================================================

function createSuccessResult(stepId: string, duration: number = 100): ExecutionResult {
  return {
    stepId,
    status: 'passed',
    success: true,
    duration,
    startTime: Date.now() - duration,
    endTime: Date.now(),
  };
}

function createFailureResult(stepId: string, error: string = 'Test error'): ExecutionResult {
  return {
    stepId,
    status: 'failed',
    success: false,
    duration: 50,
    error,
    startTime: Date.now() - 50,
    endTime: Date.now(),
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('ReplayStateManager', () => {
  let manager: ReplayStateManager;
  
  beforeEach(() => {
    vi.useFakeTimers();
    resetReplayStateManager();
    manager = new ReplayStateManager();
  });
  
  afterEach(() => {
    vi.useRealTimers();
    resetReplayStateManager();
  });
  
  // ==========================================================================
  // INITIAL STATE
  // ==========================================================================
  
  describe('initial state', () => {
    it('should start in idle state', () => {
      expect(manager.getLifecycle()).toBe('idle');
      expect(manager.isIdle()).toBe(true);
    });
    
    it('should have empty progress', () => {
      const progress = manager.getProgress();
      
      expect(progress.currentStep).toBe(0);
      expect(progress.totalSteps).toBe(0);
      expect(progress.percentage).toBe(0);
    });
    
    it('should have empty timing', () => {
      const timing = manager.getTiming();
      
      expect(timing.startTime).toBeNull();
      expect(timing.endTime).toBeNull();
      expect(timing.elapsedTime).toBe(0);
    });
    
    it('should have empty results', () => {
      expect(manager.getResults()).toHaveLength(0);
    });
    
    it('should allow start but not pause/resume/stop', () => {
      expect(manager.canStart()).toBe(true);
      expect(manager.canPause()).toBe(false);
      expect(manager.canResume()).toBe(false);
      expect(manager.canStop()).toBe(false);
    });
  });
  
  // ==========================================================================
  // LIFECYCLE TRANSITIONS
  // ==========================================================================
  
  describe('lifecycle transitions', () => {
    describe('start', () => {
      it('should transition from idle to running', () => {
        const result = manager.start(10);
        
        expect(result).toBe(true);
        expect(manager.getLifecycle()).toBe('running');
        expect(manager.isRunning()).toBe(true);
      });
      
      it('should initialize progress with total steps', () => {
        manager.start(10);
        
        const progress = manager.getProgress();
        expect(progress.totalSteps).toBe(10);
        expect(progress.remainingSteps).toBe(10);
      });
      
      it('should record start time', () => {
        manager.start(10);
        
        const timing = manager.getTiming();
        expect(timing.startTime).toBe(Date.now());
      });
      
      it('should not start if already running', () => {
        manager.start(10);
        const result = manager.start(5);
        
        expect(result).toBe(false);
      });
    });
    
    describe('pause', () => {
      it('should transition from running to paused', () => {
        manager.start(10);
        const result = manager.pause();
        
        expect(result).toBe(true);
        expect(manager.getLifecycle()).toBe('paused');
        expect(manager.isPaused()).toBe(true);
      });
      
      it('should record pause time', () => {
        manager.start(10);
        manager.pause();
        
        const timing = manager.getTiming();
        expect(timing.pausedAt).toBe(Date.now());
      });
      
      it('should not pause if not running', () => {
        const result = manager.pause();
        
        expect(result).toBe(false);
      });
    });
    
    describe('resume', () => {
      it('should transition from paused to running', () => {
        manager.start(10);
        manager.pause();
        const result = manager.resume();
        
        expect(result).toBe(true);
        expect(manager.getLifecycle()).toBe('running');
      });
      
      it('should accumulate paused time', () => {
        manager.start(10);
        manager.pause();
        
        vi.advanceTimersByTime(1000);
        
        manager.resume();
        
        const timing = manager.getTiming();
        expect(timing.pausedTime).toBe(1000);
        expect(timing.pausedAt).toBeNull();
      });
      
      it('should not resume if not paused', () => {
        manager.start(10);
        const result = manager.resume();
        
        expect(result).toBe(false);
      });
    });
    
    describe('stop', () => {
      it('should transition from running to stopped', () => {
        manager.start(10);
        const result = manager.stop();
        
        expect(result).toBe(true);
        expect(manager.getLifecycle()).toBe('stopped');
        expect(manager.isStopped()).toBe(true);
      });
      
      it('should transition from paused to stopped', () => {
        manager.start(10);
        manager.pause();
        const result = manager.stop();
        
        expect(result).toBe(true);
        expect(manager.getLifecycle()).toBe('stopped');
      });
      
      it('should record end time', () => {
        manager.start(10);
        vi.advanceTimersByTime(1000);
        manager.stop();
        
        const timing = manager.getTiming();
        expect(timing.endTime).toBe(Date.now());
      });
      
      it('should not stop if idle', () => {
        const result = manager.stop();
        
        expect(result).toBe(false);
      });
    });
    
    describe('complete', () => {
      it('should transition from running to completed', () => {
        manager.start(10);
        const result = manager.complete();
        
        expect(result).toBe(true);
        expect(manager.getLifecycle()).toBe('completed');
        expect(manager.isCompleted()).toBe(true);
      });
      
      it('should set progress to 100%', () => {
        manager.start(10);
        manager.complete();
        
        expect(manager.getProgress().percentage).toBe(100);
      });
      
      it('should not complete if not running', () => {
        manager.start(10);
        manager.pause();
        const result = manager.complete();
        
        expect(result).toBe(false);
      });
    });
    
    describe('setError', () => {
      it('should transition to error state', () => {
        manager.start(10);
        const result = manager.setError('Test error');
        
        expect(result).toBe(true);
        expect(manager.getLifecycle()).toBe('error');
        expect(manager.isError()).toBe(true);
        expect(manager.getError()).toBe('Test error');
      });
    });
    
    describe('reset', () => {
      it('should return to idle state', () => {
        manager.start(10);
        manager.completeStep(createSuccessResult('step-1'));
        manager.stop();
        
        manager.reset();
        
        expect(manager.getLifecycle()).toBe('idle');
        expect(manager.getResults()).toHaveLength(0);
        expect(manager.getProgress().totalSteps).toBe(0);
      });
    });
  });
  
  // ==========================================================================
  // PROGRESS TRACKING
  // ==========================================================================
  
  describe('progress tracking', () => {
    beforeEach(() => {
      manager.start(10);
    });
    
    it('should update current step', () => {
      manager.setCurrentStep(5);
      
      const progress = manager.getProgress();
      expect(progress.currentStep).toBe(5);
      expect(progress.percentage).toBe(50);
      expect(progress.remainingSteps).toBe(5);
    });
    
    it('should track passed steps', () => {
      manager.completeStep(createSuccessResult('step-1'));
      manager.completeStep(createSuccessResult('step-2'));
      
      expect(manager.getProgress().passedSteps).toBe(2);
    });
    
    it('should track failed steps', () => {
      manager.completeStep(createFailureResult('step-1'));
      
      expect(manager.getProgress().failedSteps).toBe(1);
    });
    
    it('should track skipped steps', () => {
      manager.skipStep('step-1');
      
      expect(manager.getProgress().skippedSteps).toBe(1);
    });
    
    it('should calculate progress percentage', () => {
      manager.completeStep(createSuccessResult('step-1'));
      manager.completeStep(createSuccessResult('step-2'));
      manager.completeStep(createSuccessResult('step-3'));
      
      expect(manager.getProgress().percentage).toBe(30);
    });
  });
  
  // ==========================================================================
  // TIMING
  // ==========================================================================
  
  describe('timing', () => {
    it('should calculate elapsed time', () => {
      manager.start(10);
      vi.advanceTimersByTime(5000);
      
      expect(manager.getTiming().elapsedTime).toBe(5000);
    });
    
    it('should exclude paused time', () => {
      manager.start(10);
      vi.advanceTimersByTime(3000);
      
      manager.pause();
      vi.advanceTimersByTime(2000);
      
      manager.resume();
      vi.advanceTimersByTime(1000);
      
      // Total 6000ms, but 2000ms paused
      expect(manager.getTiming().elapsedTime).toBe(4000);
    });
    
    it('should calculate average step duration', () => {
      manager.start(10);
      
      manager.completeStep({ ...createSuccessResult('s1'), duration: 100 });
      manager.completeStep({ ...createSuccessResult('s2'), duration: 200 });
      manager.completeStep({ ...createSuccessResult('s3'), duration: 300 });
      
      expect(manager.getTiming().averageStepDuration).toBe(200);
    });
    
    it('should estimate remaining time', () => {
      manager.start(10);
      
      // Complete 3 steps with 200ms average
      manager.completeStep({ ...createSuccessResult('s1'), duration: 200 });
      manager.completeStep({ ...createSuccessResult('s2'), duration: 200 });
      manager.completeStep({ ...createSuccessResult('s3'), duration: 200 });
      
      // 7 remaining * 200ms = 1400ms
      expect(manager.getTiming().estimatedRemaining).toBe(1400);
    });
  });
  
  // ==========================================================================
  // STATE CHANGE EVENTS
  // ==========================================================================
  
  describe('state change events', () => {
    it('should emit lifecycle changes', () => {
      const events: StateChangeEvent[] = [];
      manager.onStateChange((event) => events.push(event));
      
      manager.start(10);
      
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('lifecycle');
      expect(events[0].previousState.lifecycle).toBe('idle');
      expect(events[0].newState.lifecycle).toBe('running');
    });
    
    it('should emit progress changes', () => {
      manager.start(10);
      
      const events: StateChangeEvent[] = [];
      manager.onStateChange((event) => events.push(event));
      
      manager.setCurrentStep(5);
      
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('progress');
    });
    
    it('should emit step-completed events', () => {
      manager.start(10);
      
      const events: StateChangeEvent[] = [];
      manager.onStateChange((event) => events.push(event));
      
      manager.completeStep(createSuccessResult('step-1'));
      
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('step-completed');
    });
    
    it('should allow unsubscribing', () => {
      const events: StateChangeEvent[] = [];
      const unsubscribe = manager.onStateChange((event) => events.push(event));
      
      manager.start(10);
      expect(events).toHaveLength(1);
      
      unsubscribe();
      
      manager.pause();
      expect(events).toHaveLength(1); // No new events
    });
  });
  
  // ==========================================================================
  // RESULT QUERIES
  // ==========================================================================
  
  describe('result queries', () => {
    beforeEach(() => {
      manager.start(5);
      manager.completeStep(createSuccessResult('step-1'));
      manager.completeStep(createFailureResult('step-2'));
      manager.completeStep(createSuccessResult('step-3'));
    });
    
    it('should get result for specific step', () => {
      const result = manager.getResultForStep(1);
      
      expect(result?.stepId).toBe('step-2');
      expect(result?.status).toBe('failed');
    });
    
    it('should get last result', () => {
      const result = manager.getLastResult();
      
      expect(result?.stepId).toBe('step-3');
    });
    
    it('should get failed results', () => {
      const failed = manager.getFailedResults();
      
      expect(failed).toHaveLength(1);
      expect(failed[0].stepId).toBe('step-2');
    });
    
    it('should get passed results', () => {
      const passed = manager.getPassedResults();
      
      expect(passed).toHaveLength(2);
    });
    
    it('should calculate success rate', () => {
      expect(manager.getSuccessRate()).toBeCloseTo(0.666, 2);
    });
    
    it('should check if all steps passed', () => {
      expect(manager.allStepsPassed()).toBe(false);
    });
  });
  
  // ==========================================================================
  // SNAPSHOT
  // ==========================================================================
  
  describe('snapshot', () => {
    it('should return complete state snapshot', () => {
      manager.start(10);
      manager.completeStep(createSuccessResult('step-1'));
      
      const snapshot = manager.getSnapshot();
      
      expect(snapshot.lifecycle).toBe('running');
      expect(snapshot.progress.currentStep).toBe(1);
      expect(snapshot.results).toHaveLength(1);
      expect(snapshot.canPause).toBe(true);
      expect(snapshot.canResume).toBe(false);
    });
  });
});

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================

describe('utility functions', () => {
  describe('formatElapsedTime', () => {
    it('should format seconds', () => {
      expect(formatElapsedTime(5000)).toBe('5s');
    });
    
    it('should format minutes and seconds', () => {
      expect(formatElapsedTime(125000)).toBe('2m 5s');
    });
    
    it('should format hours, minutes, and seconds', () => {
      expect(formatElapsedTime(3725000)).toBe('1h 2m 5s');
    });
  });
  
  describe('formatEta', () => {
    it('should format null as calculating', () => {
      expect(formatEta(null)).toBe('Calculating...');
    });
    
    it('should format zero as complete', () => {
      expect(formatEta(0)).toBe('Complete');
    });
    
    it('should format time remaining', () => {
      expect(formatEta(60000)).toBe('~1m 0s remaining');
    });
  });
  
  describe('getLifecycleDisplayName', () => {
    it('should return display names', () => {
      expect(getLifecycleDisplayName('idle')).toBe('Ready');
      expect(getLifecycleDisplayName('running')).toBe('Running');
      expect(getLifecycleDisplayName('completed')).toBe('Completed');
    });
  });
  
  describe('getLifecycleColor', () => {
    it('should return colors', () => {
      expect(getLifecycleColor('running')).toBe('blue');
      expect(getLifecycleColor('completed')).toBe('green');
      expect(getLifecycleColor('error')).toBe('red');
    });
  });
  
  describe('isValidTransition', () => {
    it('should validate transitions', () => {
      expect(isValidTransition('idle', 'running')).toBe(true);
      expect(isValidTransition('running', 'paused')).toBe(true);
      expect(isValidTransition('idle', 'paused')).toBe(false);
    });
  });
});

// ============================================================================
// FACTORY AND SINGLETON TESTS
// ============================================================================

describe('factory and singleton', () => {
  beforeEach(() => {
    resetReplayStateManager();
  });
  
  afterEach(() => {
    resetReplayStateManager();
  });
  
  describe('createReplayStateManager', () => {
    it('should create new instance', () => {
      const manager = createReplayStateManager();
      expect(manager.getLifecycle()).toBe('idle');
    });
  });
  
  describe('getReplayStateManager', () => {
    it('should return same instance', () => {
      const m1 = getReplayStateManager();
      const m2 = getReplayStateManager();
      
      expect(m1).toBe(m2);
    });
  });
  
  describe('resetReplayStateManager', () => {
    it('should reset instance', () => {
      const m1 = getReplayStateManager();
      m1.start(10);
      
      resetReplayStateManager();
      
      const m2 = getReplayStateManager();
      expect(m2.getLifecycle()).toBe('idle');
      expect(m2).not.toBe(m1);
    });
  });
});

// ============================================================================
// HELPER FUNCTION TESTS
// ============================================================================

describe('helper functions', () => {
  describe('createEmptyProgress', () => {
    it('should create empty progress', () => {
      const progress = createEmptyProgress();
      
      expect(progress.currentStep).toBe(0);
      expect(progress.totalSteps).toBe(0);
      expect(progress.percentage).toBe(0);
    });
  });
  
  describe('createEmptyTiming', () => {
    it('should create empty timing', () => {
      const timing = createEmptyTiming();
      
      expect(timing.startTime).toBeNull();
      expect(timing.elapsedTime).toBe(0);
    });
  });
  
  describe('createEmptySnapshot', () => {
    it('should create empty snapshot', () => {
      const snapshot = createEmptySnapshot();
      
      expect(snapshot.lifecycle).toBe('idle');
      expect(snapshot.canStart).toBe(true);
    });
  });
});
