/**
 * RecordingController Test Suite
 * @module core/recording/RecordingController.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  RecordingController,
  createRecordingController,
  DEFAULT_RECORDING_OPTIONS,
  STATE_TRANSITIONS,
  BUFFER_FLUSH_THRESHOLD,
} from './RecordingController';

// ============================================================================
// MOCK SETUP
// ============================================================================

// Mock browser globals
Object.defineProperty(global, 'window', {
  writable: true,
  value: {
    location: {
      origin: 'http://localhost:3000',
    },
    innerWidth: 1920,
    innerHeight: 1080,
    devicePixelRatio: 1,
    scrollX: 0,
    scrollY: 0,
  },
});

Object.defineProperty(global, 'navigator', {
  writable: true,
  value: {
    userAgent: 'Mozilla/5.0 (Test) AppleWebKit/537.36',
  },
});

// Mock document event listeners
const eventListeners = new Map<string, Set<EventListener>>();

Object.defineProperty(global, 'document', {
  writable: true,
  value: {
    addEventListener: vi.fn((type: string, listener: EventListener) => {
      if (!eventListeners.has(type)) {
        eventListeners.set(type, new Set());
      }
      eventListeners.get(type)!.add(listener);
    }),
    removeEventListener: vi.fn((type: string, listener: EventListener) => {
      eventListeners.get(type)?.delete(listener);
    }),
    createElement: (tag: string) => ({
      tagName: tag.toUpperCase(),
      setAttribute: vi.fn(),
      getAttribute: vi.fn(),
      className: '',
      id: '',
    }),
  },
});

// ============================================================================
// CONSTANT TESTS
// ============================================================================

describe('RecordingController constants', () => {
  it('should have default recording options', () => {
    expect(DEFAULT_RECORDING_OPTIONS.captureClicks).toBe(true);
    expect(DEFAULT_RECORDING_OPTIONS.captureInput).toBe(true);
    expect(DEFAULT_RECORDING_OPTIONS.inputDebounceMs).toBe(300);
  });
  
  it('should have valid state transitions', () => {
    expect(STATE_TRANSITIONS.idle).toContain('recording');
    expect(STATE_TRANSITIONS.recording).toContain('paused');
    expect(STATE_TRANSITIONS.recording).toContain('idle');
    expect(STATE_TRANSITIONS.paused).toContain('recording');
  });
});

// ============================================================================
// LIFECYCLE TESTS
// ============================================================================

describe('RecordingController lifecycle', () => {
  let controller: RecordingController;
  
  beforeEach(() => {
    controller = createRecordingController();
  });
  
  afterEach(async () => {
    await controller.destroy();
  });
  
  describe('initial state', () => {
    it('should start in idle state', () => {
      expect(controller.state).toBe('idle');
      expect(controller.isIdle).toBe(true);
      expect(controller.isRecording).toBe(false);
    });
    
    it('should have no session', () => {
      expect(controller.session).toBeNull();
    });
    
    it('should have default options', () => {
      expect(controller.options).toEqual(expect.objectContaining({
        captureClicks: true,
        captureInput: true,
      }));
    });
  });
  
  describe('start()', () => {
    it('should start recording', async () => {
      const session = await controller.start();
      
      expect(controller.state).toBe('recording');
      expect(controller.isRecording).toBe(true);
      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
    });
    
    it('should create session with provided options', async () => {
      const session = await controller.start({
        testCaseId: 'test-1',
        testCaseName: 'My Test',
        description: 'Test description',
      });
      
      expect(session.testCaseId).toBe('test-1');
      expect(session.testCaseName).toBe('My Test');
      expect(session.description).toBe('Test description');
    });
    
    it('should capture metadata', async () => {
      const session = await controller.start();
      
      expect(session.metadata).toEqual(expect.objectContaining({
        userAgent: expect.any(String),
        screenWidth: expect.any(Number),
        screenHeight: expect.any(Number),
      }));
    });
    
    it('should throw when already recording', async () => {
      await controller.start();
      
      await expect(controller.start()).rejects.toThrow(/Cannot start/);
    });
  });
  
  describe('stop()', () => {
    it('should stop recording', async () => {
      await controller.start();
      const session = await controller.stop();
      
      expect(controller.state).toBe('idle');
      expect(controller.isIdle).toBe(true);
      expect(session.endTime).toBeDefined();
    });
    
    it('should flush buffer on stop', async () => {
      await controller.start();
      controller.recordStep({ type: 'click' });
      
      const session = await controller.stop();
      
      expect(session.steps.length).toBe(1);
    });
    
    it('should throw when not recording', async () => {
      await expect(controller.stop()).rejects.toThrow(/No active/);
    });
  });
  
  describe('pause() and resume()', () => {
    it('should pause recording', async () => {
      await controller.start();
      await controller.pause();
      
      expect(controller.state).toBe('paused');
      expect(controller.isPaused).toBe(true);
    });
    
    it('should resume recording', async () => {
      await controller.start();
      await controller.pause();
      await controller.resume();
      
      expect(controller.state).toBe('recording');
      expect(controller.isRecording).toBe(true);
    });
    
    it('should throw when not recording', async () => {
      await expect(controller.pause()).rejects.toThrow(/No active/);
    });
  });
  
  describe('cancel()', () => {
    it('should cancel recording', async () => {
      await controller.start();
      controller.recordStep({ type: 'click' });
      
      await controller.cancel();
      
      expect(controller.state).toBe('idle');
      expect(controller.session).toBeNull();
    });
    
    it('should do nothing when already idle', async () => {
      await controller.cancel();
      expect(controller.state).toBe('idle');
    });
  });
});

// ============================================================================
// STEP MANAGEMENT TESTS
// ============================================================================

describe('RecordingController step management', () => {
  let controller: RecordingController;
  
  beforeEach(async () => {
    controller = createRecordingController();
    await controller.start();
  });
  
  afterEach(async () => {
    await controller.destroy();
  });
  
  describe('recordStep()', () => {
    it('should record a step', () => {
      const step = controller.recordStep({
        type: 'click',
        target: {
          tagName: 'button',
          xpath: '/html/body/button',
          cssSelector: 'button',
        },
      });
      
      expect(step.id).toBeDefined();
      expect(step.type).toBe('click');
      expect(step.timestamp).toBeDefined();
    });
    
    it('should throw when not recording', async () => {
      await controller.stop();
      
      expect(() => controller.recordStep({ type: 'click' })).toThrow(/Not currently/);
    });
    
    it('should increment step count', () => {
      controller.recordStep({ type: 'click' });
      controller.recordStep({ type: 'input' });
      
      expect(controller.getSteps().length).toBe(2);
    });
    
    it('should track steps by type', () => {
      controller.recordStep({ type: 'click' });
      controller.recordStep({ type: 'click' });
      controller.recordStep({ type: 'input' });
      
      const stats = controller.getStats();
      expect(stats.stepsByType.click).toBe(2);
      expect(stats.stepsByType.input).toBe(1);
    });
  });
  
  describe('undo() and redo()', () => {
    it('should undo step', () => {
      controller.recordStep({ type: 'click' });
      controller.recordStep({ type: 'input' });
      controller.flushBuffer();
      
      const undone = controller.undo();
      
      expect(undone?.type).toBe('input');
      expect(controller.getSteps().length).toBe(1);
    });
    
    it('should redo step', () => {
      controller.recordStep({ type: 'click' });
      controller.flushBuffer();
      
      controller.undo();
      const redone = controller.redo();
      
      expect(redone?.type).toBe('click');
      expect(controller.getSteps().length).toBe(1);
    });
    
    it('should return null when nothing to undo', () => {
      expect(controller.undo()).toBeNull();
    });
    
    it('should return null when nothing to redo', () => {
      expect(controller.redo()).toBeNull();
    });
    
    it('should track undo/redo availability', () => {
      expect(controller.canUndo).toBe(false);
      
      controller.recordStep({ type: 'click' });
      controller.flushBuffer();
      
      expect(controller.canUndo).toBe(true);
      expect(controller.canRedo).toBe(false);
      
      controller.undo();
      
      expect(controller.canUndo).toBe(false);
      expect(controller.canRedo).toBe(true);
    });
  });
  
  describe('deleteStep()', () => {
    it('should delete step by ID', () => {
      const step = controller.recordStep({ type: 'click' });
      controller.flushBuffer();
      
      const deleted = controller.deleteStep(step.id);
      
      expect(deleted).toBe(true);
      expect(controller.getSteps().length).toBe(0);
    });
    
    it('should return false for nonexistent step', () => {
      expect(controller.deleteStep('nonexistent')).toBe(false);
    });
  });
  
  describe('updateStep()', () => {
    it('should update step', () => {
      const step = controller.recordStep({ type: 'click' });
      controller.flushBuffer();
      
      const updated = controller.updateStep(step.id, {
        value: 'new value',
      });
      
      expect(updated?.value).toBe('new value');
      expect(updated?.type).toBe('click'); // Type unchanged
    });
    
    it('should return null for nonexistent step', () => {
      expect(controller.updateStep('nonexistent', {})).toBeNull();
    });
  });
  
  describe('flushBuffer()', () => {
    it('should move buffered steps to session', () => {
      controller.recordStep({ type: 'click' });
      controller.recordStep({ type: 'input' });
      
      expect(controller.session?.steps.length).toBe(0);
      
      controller.flushBuffer();
      
      expect(controller.session?.steps.length).toBe(2);
    });
    
    it('should auto-flush at threshold', () => {
      for (let i = 0; i < BUFFER_FLUSH_THRESHOLD; i++) {
        controller.recordStep({ type: 'click' });
      }
      
      // Should have auto-flushed
      expect(controller.session?.steps.length).toBe(BUFFER_FLUSH_THRESHOLD);
    });
  });
});

// ============================================================================
// CALLBACK TESTS
// ============================================================================

describe('RecordingController callbacks', () => {
  it('should call onStepRecorded', async () => {
    const onStepRecorded = vi.fn();
    const controller = createRecordingController({ onStepRecorded });
    
    await controller.start();
    controller.recordStep({ type: 'click' });
    
    expect(onStepRecorded).toHaveBeenCalled();
    
    await controller.destroy();
  });
  
  it('should call onStateChange', async () => {
    const onStateChange = vi.fn();
    const controller = createRecordingController({ onStateChange });
    
    await controller.start();
    
    expect(onStateChange).toHaveBeenCalledWith('recording', 'idle');
    
    await controller.stop();
    
    expect(onStateChange).toHaveBeenCalledWith('idle', 'recording');
    
    await controller.destroy();
  });
  
  it('should call onError on error', async () => {
    const onError = vi.fn();
    const controller = createRecordingController({
      onError,
      options: { maxStepsPerSession: 1 },
    });
    
    await controller.start();
    controller.recordStep({ type: 'click' });
    controller.flushBuffer(); // Flush to move from buffer to session
    
    try {
      controller.recordStep({ type: 'click' });
    } catch (e) {
      // Expected to throw
    }
    
    expect(onError).toHaveBeenCalled();
    
    await controller.destroy();
  });
});

// ============================================================================
// AUTO-SAVE TESTS
// ============================================================================

describe('RecordingController auto-save', () => {
  it('should trigger auto-save', async () => {
    vi.useFakeTimers();
    
    const onAutoSave = vi.fn().mockResolvedValue(undefined);
    const controller = createRecordingController({
      onAutoSave,
      options: { autoSaveIntervalMs: 1000 },
    });
    
    await controller.start();
    
    // Advance timers to trigger auto-save
    await vi.advanceTimersByTimeAsync(1000);
    
    expect(onAutoSave).toHaveBeenCalled();
    
    await controller.destroy();
    vi.useRealTimers();
  });
});

// ============================================================================
// STATISTICS TESTS
// ============================================================================

describe('RecordingController statistics', () => {
  let controller: RecordingController;
  
  beforeEach(() => {
    controller = createRecordingController();
  });
  
  afterEach(async () => {
    await controller.destroy();
  });
  
  it('should track sessions started', async () => {
    await controller.start();
    await controller.stop();
    await controller.start();
    
    const stats = controller.getStats();
    expect(stats.sessionsStarted).toBe(2);
    
    await controller.destroy();
  });
  
  it('should track sessions completed', async () => {
    await controller.start();
    await controller.stop();
    
    const stats = controller.getStats();
    expect(stats.sessionsCompleted).toBe(1);
  });
  
  it('should track total steps', async () => {
    await controller.start();
    controller.recordStep({ type: 'click' });
    controller.recordStep({ type: 'input' });
    
    const stats = controller.getStats();
    expect(stats.totalSteps).toBe(2);
    
    await controller.destroy();
  });
  
  it('should reset stats', async () => {
    await controller.start();
    controller.recordStep({ type: 'click' });
    
    controller.resetStats();
    
    const stats = controller.getStats();
    expect(stats.totalSteps).toBe(0);
    
    await controller.destroy();
  });
});

// ============================================================================
// CUSTOM OPTIONS TESTS
// ============================================================================

describe('RecordingController custom options', () => {
  it('should merge custom options', () => {
    const controller = createRecordingController({
      options: {
        captureScrolls: true,
        inputDebounceMs: 500,
      },
    });
    
    expect(controller.options.captureScrolls).toBe(true);
    expect(controller.options.inputDebounceMs).toBe(500);
    expect(controller.options.captureClicks).toBe(true); // Default preserved
  });
});
