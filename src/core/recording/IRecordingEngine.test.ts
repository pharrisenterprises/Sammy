/**
 * Tests for IRecordingEngine interface and utilities
 * @module core/recording/IRecordingEngine.test
 */

import { describe, it, expect } from 'vitest';
import {
  // Types
  type RecordingStatus,
  type RecordingState,
  type RecordingConfig,
  type RecordingEvent,
  type RecordingEventType,
  type CaptureEventType,
  type IRecordingEngine,
  type ILabelDetectionStrategy,
  type LabelDetectionResult,
  type RecordingSession,
  
  // Constants
  DEFAULT_CAPTURE_CONFIG,
  DEFAULT_LABEL_DETECTION_CONFIG,
  DEFAULT_RECORDING_CONFIG,
  INITIAL_RECORDING_STATE,
  
  // Functions
  createRecordingConfig,
  isRecordingStatus,
  isRecordingEventType,
  isCaptureEventType,
} from './IRecordingEngine';
import type { RecordedStep } from '../types/steps';

// ============================================================================
// DEFAULT CONFIGURATION TESTS
// ============================================================================

describe('DEFAULT_CAPTURE_CONFIG', () => {
  it('should have expected default event types', () => {
    expect(DEFAULT_CAPTURE_CONFIG.captureEvents).toContain('click');
    expect(DEFAULT_CAPTURE_CONFIG.captureEvents).toContain('input');
    expect(DEFAULT_CAPTURE_CONFIG.captureEvents).toContain('change');
    expect(DEFAULT_CAPTURE_CONFIG.captureEvents).toContain('keydown');
  });
  
  it('should enable iframe capture by default', () => {
    expect(DEFAULT_CAPTURE_CONFIG.includeIframes).toBe(true);
  });
  
  it('should enable shadow DOM capture by default', () => {
    expect(DEFAULT_CAPTURE_CONFIG.includeShadowDOM).toBe(true);
  });
  
  it('should disable closed shadow DOM by default', () => {
    expect(DEFAULT_CAPTURE_CONFIG.includeClosedShadowDOM).toBe(false);
  });
  
  it('should filter synthetic events by default', () => {
    expect(DEFAULT_CAPTURE_CONFIG.filterSyntheticEvents).toBe(true);
  });
  
  it('should have reasonable debounce delay', () => {
    expect(DEFAULT_CAPTURE_CONFIG.inputDebounceMs).toBeGreaterThanOrEqual(100);
    expect(DEFAULT_CAPTURE_CONFIG.inputDebounceMs).toBeLessThanOrEqual(500);
  });
  
  it('should enable visual feedback by default', () => {
    expect(DEFAULT_CAPTURE_CONFIG.enableVisualFeedback).toBe(true);
    expect(DEFAULT_CAPTURE_CONFIG.highlightDurationMs).toBeGreaterThan(0);
    expect(DEFAULT_CAPTURE_CONFIG.highlightClassName).toBeTruthy();
  });
});

describe('DEFAULT_LABEL_DETECTION_CONFIG', () => {
  it('should enable Google Forms detection', () => {
    expect(DEFAULT_LABEL_DETECTION_CONFIG.enableGoogleForms).toBe(true);
  });
  
  it('should enable ARIA detection', () => {
    expect(DEFAULT_LABEL_DETECTION_CONFIG.enableAria).toBe(true);
  });
  
  it('should enable Bootstrap detection', () => {
    expect(DEFAULT_LABEL_DETECTION_CONFIG.enableBootstrap).toBe(true);
  });
  
  it('should enable Material-UI detection', () => {
    expect(DEFAULT_LABEL_DETECTION_CONFIG.enableMaterialUI).toBe(true);
  });
  
  it('should have reasonable confidence threshold', () => {
    expect(DEFAULT_LABEL_DETECTION_CONFIG.minConfidence).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_LABEL_DETECTION_CONFIG.minConfidence).toBeLessThanOrEqual(1);
  });
  
  it('should have reasonable max label length', () => {
    expect(DEFAULT_LABEL_DETECTION_CONFIG.maxLabelLength).toBeGreaterThan(0);
    expect(DEFAULT_LABEL_DETECTION_CONFIG.maxLabelLength).toBeLessThanOrEqual(500);
  });
  
  it('should have empty custom strategies array', () => {
    expect(DEFAULT_LABEL_DETECTION_CONFIG.customStrategies).toEqual([]);
  });
});

describe('INITIAL_RECORDING_STATE', () => {
  it('should have idle status', () => {
    expect(INITIAL_RECORDING_STATE.status).toBe('idle');
  });
  
  it('should not be recording', () => {
    expect(INITIAL_RECORDING_STATE.isRecording).toBe(false);
  });
  
  it('should not be paused', () => {
    expect(INITIAL_RECORDING_STATE.isPaused).toBe(false);
  });
  
  it('should have null timestamps', () => {
    expect(INITIAL_RECORDING_STATE.startedAt).toBeNull();
    expect(INITIAL_RECORDING_STATE.pausedAt).toBeNull();
  });
  
  it('should have zero duration and step count', () => {
    expect(INITIAL_RECORDING_STATE.duration).toBe(0);
    expect(INITIAL_RECORDING_STATE.stepCount).toBe(0);
  });
  
  it('should have null session ID', () => {
    expect(INITIAL_RECORDING_STATE.sessionId).toBeNull();
  });
  
  it('should have null error', () => {
    expect(INITIAL_RECORDING_STATE.error).toBeNull();
  });
});

// ============================================================================
// CONFIGURATION FACTORY TESTS
// ============================================================================

describe('createRecordingConfig', () => {
  it('should create config with required projectId', () => {
    const config = createRecordingConfig('test-project');
    expect(config.projectId).toBe('test-project');
  });
  
  it('should include default capture config', () => {
    const config = createRecordingConfig('test-project');
    expect(config.capture).toEqual(DEFAULT_CAPTURE_CONFIG);
  });
  
  it('should include default label detection config', () => {
    const config = createRecordingConfig('test-project');
    expect(config.labelDetection).toEqual(DEFAULT_LABEL_DETECTION_CONFIG);
  });
  
  it('should allow overriding session name', () => {
    const config = createRecordingConfig('test-project', {
      sessionName: 'My Session',
    });
    expect(config.sessionName).toBe('My Session');
  });
  
  it('should allow overriding capture config', () => {
    const config = createRecordingConfig('test-project', {
      capture: {
        ...DEFAULT_CAPTURE_CONFIG,
        includeIframes: false,
        inputDebounceMs: 500,
      },
    });
    expect(config.capture.includeIframes).toBe(false);
    expect(config.capture.inputDebounceMs).toBe(500);
    // Other properties should remain default
    expect(config.capture.includeShadowDOM).toBe(true);
  });
  
  it('should allow overriding label detection config', () => {
    const config = createRecordingConfig('test-project', {
      labelDetection: {
        ...DEFAULT_LABEL_DETECTION_CONFIG,
        enableGoogleForms: false,
        minConfidence: 0.7,
      },
    });
    expect(config.labelDetection.enableGoogleForms).toBe(false);
    expect(config.labelDetection.minConfidence).toBe(0.7);
    // Other properties should remain default
    expect(config.labelDetection.enableAria).toBe(true);
  });
  
  it('should allow setting max steps', () => {
    const config = createRecordingConfig('test-project', {
      maxSteps: 100,
    });
    expect(config.maxSteps).toBe(100);
  });
  
  it('should allow setting max duration', () => {
    const config = createRecordingConfig('test-project', {
      maxDurationMs: 60000,
    });
    expect(config.maxDurationMs).toBe(60000);
  });
  
  it('should allow configuring auto-save', () => {
    const config = createRecordingConfig('test-project', {
      autoSave: false,
      autoSaveIntervalMs: 10000,
    });
    expect(config.autoSave).toBe(false);
    expect(config.autoSaveIntervalMs).toBe(10000);
  });
});

// ============================================================================
// TYPE GUARD TESTS
// ============================================================================

describe('isRecordingStatus', () => {
  it('should return true for valid statuses', () => {
    expect(isRecordingStatus('idle')).toBe(true);
    expect(isRecordingStatus('recording')).toBe(true);
    expect(isRecordingStatus('paused')).toBe(true);
    expect(isRecordingStatus('stopping')).toBe(true);
    expect(isRecordingStatus('error')).toBe(true);
  });
  
  it('should return false for invalid statuses', () => {
    expect(isRecordingStatus('unknown')).toBe(false);
    expect(isRecordingStatus('running')).toBe(false);
    expect(isRecordingStatus('')).toBe(false);
  });
  
  it('should return false for non-strings', () => {
    expect(isRecordingStatus(null)).toBe(false);
    expect(isRecordingStatus(undefined)).toBe(false);
    expect(isRecordingStatus(123)).toBe(false);
    expect(isRecordingStatus({})).toBe(false);
  });
});

describe('isRecordingEventType', () => {
  it('should return true for valid event types', () => {
    expect(isRecordingEventType('recording:started')).toBe(true);
    expect(isRecordingEventType('recording:stopped')).toBe(true);
    expect(isRecordingEventType('recording:paused')).toBe(true);
    expect(isRecordingEventType('recording:resumed')).toBe(true);
    expect(isRecordingEventType('recording:error')).toBe(true);
    expect(isRecordingEventType('step:captured')).toBe(true);
    expect(isRecordingEventType('step:updated')).toBe(true);
    expect(isRecordingEventType('step:removed')).toBe(true);
    expect(isRecordingEventType('state:changed')).toBe(true);
  });
  
  it('should return false for invalid event types', () => {
    expect(isRecordingEventType('unknown:event')).toBe(false);
    expect(isRecordingEventType('click')).toBe(false);
    expect(isRecordingEventType('')).toBe(false);
  });
  
  it('should return false for non-strings', () => {
    expect(isRecordingEventType(null)).toBe(false);
    expect(isRecordingEventType(undefined)).toBe(false);
    expect(isRecordingEventType(123)).toBe(false);
  });
});

describe('isCaptureEventType', () => {
  it('should return true for valid capture event types', () => {
    expect(isCaptureEventType('click')).toBe(true);
    expect(isCaptureEventType('dblclick')).toBe(true);
    expect(isCaptureEventType('input')).toBe(true);
    expect(isCaptureEventType('change')).toBe(true);
    expect(isCaptureEventType('keydown')).toBe(true);
    expect(isCaptureEventType('keyup')).toBe(true);
    expect(isCaptureEventType('keypress')).toBe(true);
    expect(isCaptureEventType('focus')).toBe(true);
    expect(isCaptureEventType('blur')).toBe(true);
    expect(isCaptureEventType('mousedown')).toBe(true);
    expect(isCaptureEventType('mouseup')).toBe(true);
    expect(isCaptureEventType('submit')).toBe(true);
    expect(isCaptureEventType('scroll')).toBe(true);
  });
  
  it('should return false for invalid capture event types', () => {
    expect(isCaptureEventType('mousemove')).toBe(false);
    expect(isCaptureEventType('touchstart')).toBe(false);
    expect(isCaptureEventType('')).toBe(false);
  });
  
  it('should return false for non-strings', () => {
    expect(isCaptureEventType(null)).toBe(false);
    expect(isCaptureEventType(undefined)).toBe(false);
    expect(isCaptureEventType(123)).toBe(false);
  });
});

// ============================================================================
// TYPE COMPATIBILITY TESTS
// ============================================================================

describe('Type compatibility', () => {
  it('should allow creating RecordingState objects', () => {
    const state: RecordingState = {
      status: 'recording',
      isRecording: true,
      isPaused: false,
      startedAt: Date.now(),
      pausedAt: null,
      duration: 5000,
      stepCount: 10,
      sessionId: 'session-123',
      error: null,
    };
    
    expect(state.isRecording).toBe(true);
    expect(state.stepCount).toBe(10);
  });
  
  it('should allow creating LabelDetectionResult objects', () => {
    const result: LabelDetectionResult = {
      label: 'Email Address',
      confidence: 0.9,
      strategy: 'aria-label',
      metadata: { source: 'aria-labelledby' },
    };
    
    expect(result.label).toBe('Email Address');
    expect(result.confidence).toBe(0.9);
  });
  
  it('should allow creating RecordingSession objects', () => {
    const session: RecordingSession = {
      id: 'session-123',
      projectId: 'project-456',
      name: 'Test Session',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      duration: 30000,
      steps: [],
      startUrl: 'https://example.com',
      config: createRecordingConfig('project-456'),
    };
    
    expect(session.id).toBe('session-123');
    expect(session.steps).toEqual([]);
  });
});

// ============================================================================
// INTERFACE CONTRACT TESTS
// ============================================================================

describe('IRecordingEngine interface contract', () => {
  // These tests verify the interface shape without implementation
  
  it('should define state property', () => {
    // Type check: state should be RecordingState
    const checkStateType = (engine: IRecordingEngine) => {
      const state: RecordingState = engine.state;
      return state.status;
    };
    expect(typeof checkStateType).toBe('function');
  });
  
  it('should define lifecycle methods', () => {
    // Type check: methods should have correct signatures
    const checkMethods = (engine: IRecordingEngine) => {
      // start returns Promise<void>
      const startResult: Promise<void> = engine.start({} as RecordingConfig);
      
      // stop returns Promise<RecordedStep[]>
      const stopResult: Promise<RecordedStep[]> = engine.stop();
      
      // pause/resume return void
      const pauseResult: void = engine.pause();
      const resumeResult: void = engine.resume();
      
      return { startResult, stopResult, pauseResult, resumeResult };
    };
    expect(typeof checkMethods).toBe('function');
  });
  
  it('should define event methods', () => {
    const checkEventMethods = (engine: IRecordingEngine) => {
      engine.addEventListener('step:captured', (event) => {
        const step = event.step;
        const index = event.index;
        return { step, index };
      });
      
      engine.removeEventListener('step:captured', () => {});
      engine.removeAllListeners('step:captured');
      engine.removeAllListeners();
    };
    expect(typeof checkEventMethods).toBe('function');
  });
});

// ============================================================================
// ILABELDETECTIONSTRATEGY INTERFACE TESTS
// ============================================================================

describe('ILabelDetectionStrategy interface', () => {
  it('should allow implementing custom strategies', () => {
    const customStrategy: ILabelDetectionStrategy = {
      name: 'custom-strategy',
      baseConfidence: 0.8,
      priority: 5,
      
      detect(element: Element, document: Document): LabelDetectionResult | null {
        const ariaLabel = element.getAttribute('aria-label');
        if (ariaLabel) {
          return {
            label: ariaLabel,
            confidence: this.baseConfidence,
            strategy: this.name,
          };
        }
        return null;
      },
      
      canHandle(element: Element): boolean {
        return element.hasAttribute('aria-label');
      },
    };
    
    expect(customStrategy.name).toBe('custom-strategy');
    expect(customStrategy.baseConfidence).toBe(0.8);
    expect(customStrategy.priority).toBe(5);
    expect(typeof customStrategy.detect).toBe('function');
    expect(typeof customStrategy.canHandle).toBe('function');
  });
});
