/**
 * Tests for RecordingState
 * @module core/recording/RecordingState.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  RecordingStateManager,
  VALID_TRANSITIONS,
  TRANSITION_TARGETS,
  generateSessionId,
  isActiveStatus,
  isTerminalStatus,
  canCaptureSteps,
  getStatusLabel,
  getStatusColor,
  formatDuration,
  validateStateMachine,
  type StateAction,
  type TransitionResult,
  type RecordingStateSnapshot,
} from './RecordingState';

import { INITIAL_RECORDING_STATE } from './IRecordingEngine';

// ============================================================================
// STATE MANAGER TESTS
// ============================================================================

describe('RecordingStateManager', () => {
  let manager: RecordingStateManager;
  let mockDateNow: ReturnType<typeof vi.spyOn>;
  
  beforeEach(() => {
    manager = new RecordingStateManager();
    // Mock Date.now() directly
    mockDateNow = vi.spyOn(Date, 'now');
  });
  
  afterEach(() => {
    mockDateNow.mockRestore();
  });
  
  describe('initialization', () => {
    it('should initialize with idle state', () => {
      expect(manager.status).toBe('idle');
      expect(manager.isRecording).toBe(false);
      expect(manager.isPaused).toBe(false);
      expect(manager.stepCount).toBe(0);
      expect(manager.sessionId).toBeNull();
      expect(manager.error).toBeNull();
    });
    
    it('should accept initial state override', () => {
      const customManager = new RecordingStateManager({
        stepCount: 5,
        sessionId: 'test-session',
      });
      
      expect(customManager.stepCount).toBe(5);
      expect(customManager.sessionId).toBe('test-session');
    });
  });
  
  describe('start transition', () => {
    it('should transition from idle to recording', () => {
      const result = manager.start();
      
      expect(result.success).toBe(true);
      expect(manager.status).toBe('recording');
      expect(manager.isRecording).toBe(true);
      expect(manager.sessionId).toBeTruthy();
    });
    
    it('should accept custom session ID', () => {
      const result = manager.start('my-session-123');
      
      expect(result.success).toBe(true);
      expect(manager.sessionId).toBe('my-session-123');
    });
    
    it('should set startedAt timestamp', () => {
      const now = 1234567890;
      mockDateNow.mockReturnValue(now);
      
      manager.start();
      
      expect(manager.state.startedAt).toBe(now);
    });
    
    it('should reset step count on start', () => {
      // Simulate having steps from previous session
      const customManager = new RecordingStateManager({ stepCount: 10 });
      customManager.start();
      
      expect(customManager.stepCount).toBe(0);
    });
  });
  
  describe('stop transition', () => {
    it('should transition from recording to stopping', () => {
      manager.start();
      const result = manager.stop();
      
      expect(result.success).toBe(true);
      expect(manager.status).toBe('stopping');
      expect(manager.isRecording).toBe(false);
    });
    
    it('should transition from paused to stopping', () => {
      manager.start();
      manager.pause();
      const result = manager.stop();
      
      expect(result.success).toBe(true);
      expect(manager.status).toBe('stopping');
    });
    
    it('should fail from idle state', () => {
      const result = manager.stop();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid transition');
    });
    
    it('should calculate final duration', () => {
      mockDateNow.mockReturnValue(1000);
      manager.start();
      
      mockDateNow.mockReturnValue(6000); // 5 seconds later
      manager.stop();
      
      expect(manager.state.duration).toBe(5000);
    });
  });
  
  describe('pause transition', () => {
    it('should transition from recording to paused', () => {
      manager.start();
      const result = manager.pause();
      
      expect(result.success).toBe(true);
      expect(manager.status).toBe('paused');
      expect(manager.isPaused).toBe(true);
      expect(manager.isRecording).toBe(false);
    });
    
    it('should set pausedAt timestamp', () => {
      mockDateNow.mockReturnValue(1000);
      manager.start();
      
      mockDateNow.mockReturnValue(3000);
      manager.pause();
      
      expect(manager.state.pausedAt).toBe(3000);
    });
    
    it('should fail from idle state', () => {
      const result = manager.pause();
      
      expect(result.success).toBe(false);
    });
    
    it('should fail from already paused state', () => {
      manager.start();
      manager.pause();
      
      const result = manager.pause();
      
      expect(result.success).toBe(false);
    });
  });
  
  describe('resume transition', () => {
    it('should transition from paused to recording', () => {
      manager.start();
      manager.pause();
      const result = manager.resume();
      
      expect(result.success).toBe(true);
      expect(manager.status).toBe('recording');
      expect(manager.isRecording).toBe(true);
      expect(manager.isPaused).toBe(false);
    });
    
    it('should clear pausedAt on resume', () => {
      manager.start();
      manager.pause();
      manager.resume();
      
      expect(manager.state.pausedAt).toBeNull();
    });
    
    it('should fail from recording state', () => {
      manager.start();
      
      const result = manager.resume();
      
      expect(result.success).toBe(false);
    });
  });
  
  describe('reset transition', () => {
    it('should reset from any non-recording state', () => {
      manager.start();
      manager.pause();
      
      const result = manager.reset();
      
      expect(result.success).toBe(true);
      expect(manager.status).toBe('idle');
      expect(manager.state).toEqual(INITIAL_RECORDING_STATE);
    });
    
    it('should reset from error state', () => {
      manager.start();
      manager.setError(new Error('Test error'));
      
      const result = manager.reset();
      
      expect(result.success).toBe(true);
      expect(manager.status).toBe('idle');
      expect(manager.error).toBeNull();
    });
    
    it('should reset from stopping state', () => {
      manager.start();
      manager.stop();
      
      const result = manager.reset();
      
      expect(result.success).toBe(true);
      expect(manager.status).toBe('idle');
    });
  });
  
  describe('error transition', () => {
    it('should transition to error state', () => {
      manager.start();
      const error = new Error('Test error');
      
      const result = manager.setError(error);
      
      expect(result.success).toBe(true);
      expect(manager.status).toBe('error');
      expect(manager.error).toBe(error);
    });
    
    it('should stop recording on error', () => {
      manager.start();
      manager.setError(new Error('Test'));
      
      expect(manager.isRecording).toBe(false);
    });
  });
  
  describe('step count management', () => {
    it('should increment step count', () => {
      manager.start();
      
      manager.incrementStep();
      expect(manager.stepCount).toBe(1);
      
      manager.incrementStep();
      expect(manager.stepCount).toBe(2);
    });
    
    it('should decrement step count', () => {
      manager.start();
      manager.setStepCount(5);
      
      manager.decrementStep();
      expect(manager.stepCount).toBe(4);
    });
    
    it('should not go below zero', () => {
      manager.start();
      
      manager.decrementStep();
      expect(manager.stepCount).toBe(0);
    });
    
    it('should set step count directly', () => {
      manager.start();
      
      manager.setStepCount(10);
      expect(manager.stepCount).toBe(10);
    });
    
    it('should fail to modify steps when not recording', () => {
      const result = manager.incrementStep();
      
      expect(result.success).toBe(false);
    });
  });
  
  describe('duration tracking', () => {
    it('should track duration while recording', () => {
      // Use actual time instead of mocking
      const manager2 = new RecordingStateManager();
      const start = Date.now();
      manager2.start();
      
      // Wait a tiny bit
      const duration = manager2.duration;
      expect(duration).toBeGreaterThanOrEqual(0);
      expect(manager2.state.startedAt).toBeGreaterThanOrEqual(start);
    });
    
    it('should exclude paused time from duration', () => {
      // Mock with implementation to track calls
      let callCount = 0;
      const times = [
        1000,   // start - applyTransition (non-zero!)
        1000,   // start - emitStateChange  
        4000,   // pause - calculateDuration
        4000,   // pause - applyTransition (pausedAt)
        4000,   // pause - emitStateChange
        9000,   // resume - applyTransition (now)
        9000,   // resume - emitStateChange
        11000,  // duration getter
        11000,  // duration getter (might be called twice)
      ];
      mockDateNow.mockImplementation(() => {
        const result = times[Math.min(callCount, times.length - 1)];
        callCount++;
        return result;
      });
      
      const mgr = new RecordingStateManager();
      mgr.start();
      mgr.pause();
      mgr.resume();
      
      // Total: 3s + 2s = 5s (excluding 5s pause)
      const duration = mgr.duration;
      expect(duration).toBe(5000);
    });
    
    it('should handle multiple pause/resume cycles', () => {
      let callCount = 0;
      const times = [
        1000, 1000,       // start (non-zero!)
        3000, 3000, 3000, // pause
        5000, 5000, // resume
        7000, 7000, 7000, // pause
        10000, 10000, // resume
        12000, 12000, // duration check
      ];
      mockDateNow.mockImplementation(() => {
        const result = times[Math.min(callCount, times.length - 1)];
        callCount++;
        return result;
      });
      
      const mgr = new RecordingStateManager();
      mgr.start();
      mgr.pause();
      mgr.resume();
      mgr.pause();
      mgr.resume();
      
      // Total recording: 2s + 2s + 2s = 6s
      const duration = mgr.duration;
      expect(duration).toBe(6000);
    });
    
    it('should freeze duration when stopped', () => {
      let callCount = 0;
      const times = [
        1000, 1000,       // start (non-zero!)
        6000, 6000, 6000, // stop (calculateDuration, applyTransition, emitStateChange)
        11000,            // check after
      ];
      mockDateNow.mockImplementation(() => {
        const result = times[Math.min(callCount, times.length - 1)];
        callCount++;
        return result;
      });
      
      const mgr = new RecordingStateManager();
      mgr.start();
      mgr.stop();
      
      expect(mgr.state.duration).toBe(5000);
    });
  });
  
  describe('event subscription', () => {
    it('should notify subscribers of state changes', () => {
      const handler = vi.fn();
      manager.subscribe(handler);
      
      manager.start();
      
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'state:changed',
          previousState: expect.objectContaining({ status: 'idle' }),
          currentState: expect.objectContaining({ status: 'recording' }),
        })
      );
    });
    
    it('should allow unsubscribing', () => {
      const handler = vi.fn();
      const unsubscribe = manager.subscribe(handler);
      
      manager.start();
      expect(handler).toHaveBeenCalledTimes(1);
      
      unsubscribe();
      manager.pause();
      
      expect(handler).toHaveBeenCalledTimes(1); // Not called again
    });
    
    it('should clear all listeners', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      
      manager.subscribe(handler1);
      manager.subscribe(handler2);
      manager.clearListeners();
      
      manager.start();
      
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });
    
    it('should handle errors in handlers gracefully', () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      const goodHandler = vi.fn();
      
      manager.subscribe(errorHandler);
      manager.subscribe(goodHandler);
      
      // Should not throw
      expect(() => manager.start()).not.toThrow();
      
      // Good handler should still be called
      expect(goodHandler).toHaveBeenCalled();
    });
  });
  
  describe('canTransition', () => {
    it('should return true for valid transitions', () => {
      expect(manager.canTransition('start')).toBe(true);
      
      manager.start();
      expect(manager.canTransition('pause')).toBe(true);
      expect(manager.canTransition('stop')).toBe(true);
    });
    
    it('should return false for invalid transitions', () => {
      expect(manager.canTransition('stop')).toBe(false);
      expect(manager.canTransition('pause')).toBe(false);
      expect(manager.canTransition('resume')).toBe(false);
    });
  });
  
  describe('getValidActions', () => {
    it('should return valid actions for current state', () => {
      expect(manager.getValidActions()).toContain('start');
      expect(manager.getValidActions()).toContain('reset');
      
      manager.start();
      expect(manager.getValidActions()).toContain('pause');
      expect(manager.getValidActions()).toContain('stop');
      expect(manager.getValidActions()).not.toContain('start');
    });
  });
  
  describe('serialization', () => {
    it('should serialize to JSON', () => {
      manager.start('test-session');
      manager.incrementStep();
      manager.incrementStep();
      
      const json = manager.toJSON();
      
      expect(json.status).toBe('recording');
      expect(json.sessionId).toBe('test-session');
      expect(json.stepCount).toBe(2);
    });
    
    it('should serialize error as message', () => {
      manager.start();
      manager.setError(new Error('Test error message'));
      
      const json = manager.toJSON();
      
      expect(json.error).toBe('Test error message');
    });
    
    it('should restore from JSON', () => {
      const data = {
        status: 'paused',
        isRecording: false,
        isPaused: true,
        startedAt: 1000,
        pausedAt: 5000,
        duration: 4000,
        stepCount: 10,
        sessionId: 'restored-session',
        error: null,
        _pausedDuration: 2000,
      };
      
      const restored = RecordingStateManager.fromJSON(data);
      
      expect(restored.status).toBe('paused');
      expect(restored.isPaused).toBe(true);
      expect(restored.stepCount).toBe(10);
      expect(restored.sessionId).toBe('restored-session');
    });
  });
  
  describe('snapshot', () => {
    it('should create a snapshot', () => {
      const now = 1000;
      mockDateNow.mockReturnValue(now);
      manager.start('snapshot-test');
      manager.incrementStep();
      
      const snapshot = manager.snapshot();
      
      expect(snapshot.state.sessionId).toBe('snapshot-test');
      expect(snapshot.state.stepCount).toBe(1);
      expect(snapshot.timestamp).toBe(now);
    });
    
    it('should restore from snapshot', () => {
      manager.start();
      manager.incrementStep();
      manager.incrementStep();
      const snapshot = manager.snapshot();
      
      // Make changes
      manager.incrementStep();
      manager.incrementStep();
      expect(manager.stepCount).toBe(4);
      
      // Restore
      manager.restore(snapshot);
      expect(manager.stepCount).toBe(2);
    });
  });
});

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================

describe('generateSessionId', () => {
  it('should generate unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateSessionId());
    }
    expect(ids.size).toBe(100);
  });
  
  it('should have session prefix', () => {
    const id = generateSessionId();
    expect(id.startsWith('session_')).toBe(true);
  });
});

describe('isActiveStatus', () => {
  it('should return true for recording and paused', () => {
    expect(isActiveStatus('recording')).toBe(true);
    expect(isActiveStatus('paused')).toBe(true);
  });
  
  it('should return false for other states', () => {
    expect(isActiveStatus('idle')).toBe(false);
    expect(isActiveStatus('stopping')).toBe(false);
    expect(isActiveStatus('error')).toBe(false);
  });
});

describe('isTerminalStatus', () => {
  it('should return true for idle and error', () => {
    expect(isTerminalStatus('idle')).toBe(true);
    expect(isTerminalStatus('error')).toBe(true);
  });
  
  it('should return false for other states', () => {
    expect(isTerminalStatus('recording')).toBe(false);
    expect(isTerminalStatus('paused')).toBe(false);
    expect(isTerminalStatus('stopping')).toBe(false);
  });
});

describe('canCaptureSteps', () => {
  it('should return true only for recording', () => {
    expect(canCaptureSteps('recording')).toBe(true);
    expect(canCaptureSteps('paused')).toBe(false);
    expect(canCaptureSteps('idle')).toBe(false);
  });
});

describe('getStatusLabel', () => {
  it('should return human-readable labels', () => {
    expect(getStatusLabel('idle')).toBe('Ready');
    expect(getStatusLabel('recording')).toBe('Recording');
    expect(getStatusLabel('paused')).toBe('Paused');
    expect(getStatusLabel('stopping')).toBe('Stopping');
    expect(getStatusLabel('error')).toBe('Error');
  });
});

describe('getStatusColor', () => {
  it('should return valid hex colors', () => {
    const hexRegex = /^#[0-9a-f]{6}$/i;
    
    expect(getStatusColor('idle')).toMatch(hexRegex);
    expect(getStatusColor('recording')).toMatch(hexRegex);
    expect(getStatusColor('paused')).toMatch(hexRegex);
    expect(getStatusColor('stopping')).toMatch(hexRegex);
    expect(getStatusColor('error')).toMatch(hexRegex);
  });
});

describe('formatDuration', () => {
  it('should format milliseconds', () => {
    expect(formatDuration(500)).toBe('500ms');
  });
  
  it('should format seconds', () => {
    expect(formatDuration(5000)).toBe('5s');
    expect(formatDuration(45000)).toBe('45s');
  });
  
  it('should format minutes and seconds', () => {
    expect(formatDuration(90000)).toBe('1m 30s');
    expect(formatDuration(305000)).toBe('5m 5s');
  });
  
  it('should format hours, minutes, and seconds', () => {
    expect(formatDuration(3661000)).toBe('1h 1m 1s');
    expect(formatDuration(7200000)).toBe('2h 0m 0s');
  });
});

// ============================================================================
// STATE MACHINE VALIDATION TESTS
// ============================================================================

describe('validateStateMachine', () => {
  it('should validate the state machine configuration', () => {
    const result = validateStateMachine();
    
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe('VALID_TRANSITIONS', () => {
  it('should have transitions for all states', () => {
    const states = ['idle', 'recording', 'paused', 'stopping', 'error'];
    
    for (const state of states) {
      expect(VALID_TRANSITIONS[state as keyof typeof VALID_TRANSITIONS]).toBeDefined();
    }
  });
  
  it('should allow reset from error state', () => {
    expect(VALID_TRANSITIONS.error).toContain('reset');
  });
});

describe('TRANSITION_TARGETS', () => {
  it('should have targets for state-changing actions', () => {
    expect(TRANSITION_TARGETS.idle.start).toBe('recording');
    expect(TRANSITION_TARGETS.recording.pause).toBe('paused');
    expect(TRANSITION_TARGETS.paused.resume).toBe('recording');
    expect(TRANSITION_TARGETS.recording.stop).toBe('stopping');
  });
});
