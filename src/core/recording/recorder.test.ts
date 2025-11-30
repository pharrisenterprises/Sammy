/**
 * @fileoverview Tests for recording engine
 * @module core/recording/recorder.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  Recorder,
  createRecorder,
  shouldCaptureClickAs,
  shouldCaptureImmediately,
  DEFAULT_RECORDING_CONFIG
} from './recorder';

describe('Recorder', () => {
  let dom: JSDOM;
  let document: Document;
  let window: Window;

  beforeEach(() => {
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <form id="login-form">
            <input id="username" name="username" type="text" placeholder="Username">
            <input id="password" name="password" type="password" placeholder="Password">
            <input id="remember" name="remember" type="checkbox">
            <select id="role" name="role">
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <button id="submit-btn" type="submit">Login</button>
          </form>
          <div id="content">
            <a id="link" href="/page">Link</a>
            <button id="action-btn">Action</button>
          </div>
          <div data-sammy-ignore>Ignored Content</div>
        </body>
      </html>
    `, { url: 'http://localhost/test' });
    
    document = dom.window.document;
    window = dom.window as unknown as Window;
    global.document = document;
    global.window = window as unknown as Window & typeof globalThis;

    // Mock performance.now
    vi.spyOn(performance, 'now').mockReturnValue(1000);
  });

  afterEach(() => {
    dom.window.close();
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // CONSTANTS
  // ==========================================================================

  describe('Constants', () => {
    it('should have correct default config', () => {
      expect(DEFAULT_RECORDING_CONFIG.captureClicks).toBe(true);
      expect(DEFAULT_RECORDING_CONFIG.captureInputs).toBe(true);
      expect(DEFAULT_RECORDING_CONFIG.captureEnter).toBe(true);
      expect(DEFAULT_RECORDING_CONFIG.inputDebounce).toBe(500);
      expect(DEFAULT_RECORDING_CONFIG.highlightElements).toBe(true);
    });

    it('should have default ignored selectors', () => {
      expect(DEFAULT_RECORDING_CONFIG.ignoredSelectors).toContain('[data-sammy-ignore]');
      expect(DEFAULT_RECORDING_CONFIG.ignoredSelectors).toContain('.sammy-highlight-overlay');
    });
  });

  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================

  describe('Lifecycle', () => {
    describe('start', () => {
      it('should start recording session', () => {
        const recorder = new Recorder('project-123');
        
        const sessionId = recorder.start('http://localhost/test');

        expect(sessionId).toBeTruthy();
        expect(recorder.isRecording()).toBe(true);
        expect(recorder.getState()).toBe('recording');
      });

      it('should add initial open step', () => {
        const recorder = new Recorder('project-123');
        recorder.start('http://localhost/test');

        const steps = recorder.getCapturedSteps();

        expect(steps).toHaveLength(1);
        expect(steps[0].event).toBe('open');
        expect(steps[0].value).toBe('http://localhost/test');
      });

      it('should throw if already recording', () => {
        const recorder = new Recorder('project-123');
        recorder.start('http://localhost/test');

        expect(() => recorder.start('http://localhost/other')).toThrow();
      });

      it('should notify state change', () => {
        const recorder = new Recorder('project-123');
        const callback = vi.fn();
        recorder.onStateChange(callback);

        recorder.start('http://localhost/test');

        expect(callback).toHaveBeenCalledWith('recording', 'idle');
      });
    });

    describe('stop', () => {
      it('should stop recording and return steps', () => {
        const recorder = new Recorder('project-123');
        recorder.start('http://localhost/test');

        const steps = recorder.stop();

        expect(steps).toHaveLength(1); // Just the open step
        expect(recorder.isRecording()).toBe(false);
        expect(recorder.getState()).toBe('idle');
      });

      it('should return finalized Steps', () => {
        const recorder = new Recorder('project-123');
        recorder.start('http://localhost/test');

        const steps = recorder.stop();

        expect(steps[0].event).toBe('open');
        expect(steps[0].id).toBeTruthy();
      });

      it('should notify state change', () => {
        const recorder = new Recorder('project-123');
        recorder.start('http://localhost/test');
        const callback = vi.fn();
        recorder.onStateChange(callback);

        recorder.stop();

        expect(callback).toHaveBeenCalledWith('idle', 'recording');
      });

      it('should return empty array if not recording', () => {
        const recorder = new Recorder('project-123');
        const steps = recorder.stop();

        expect(steps).toEqual([]);
      });
    });

    describe('pause/resume', () => {
      it('should pause recording', () => {
        const recorder = new Recorder('project-123');
        recorder.start('http://localhost/test');

        recorder.pause();

        expect(recorder.isPaused()).toBe(true);
        expect(recorder.getState()).toBe('paused');
      });

      it('should resume recording', () => {
        const recorder = new Recorder('project-123');
        recorder.start('http://localhost/test');
        recorder.pause();

        recorder.resume();

        expect(recorder.isRecording()).toBe(true);
        expect(recorder.getState()).toBe('recording');
      });

      it('should not capture while paused', () => {
        const recorder = new Recorder('project-123');
        recorder.start('http://localhost/test');
        recorder.pause();

        const element = document.getElementById('submit-btn')!;
        const captured = recorder.captureClick(element);

        expect(captured).toBe(false);
        expect(recorder.getCapturedSteps()).toHaveLength(1); // Only open step
      });
    });
  });

  // ==========================================================================
  // EVENT CAPTURE
  // ==========================================================================

  describe('Event Capture', () => {
    describe('captureClick', () => {
      it('should capture click on button', () => {
        const recorder = new Recorder('project-123');
        recorder.start('http://localhost/test');

        const element = document.getElementById('submit-btn')!;
        const captured = recorder.captureClick(element);

        expect(captured).toBe(true);
        expect(recorder.getCapturedSteps()).toHaveLength(2);
        
        const step = recorder.getCapturedSteps()[1];
        expect(step.event).toBe('click');
        expect(step.bundle.tag).toBe('button');
      });

      it('should capture click on link', () => {
        const recorder = new Recorder('project-123');
        recorder.start('http://localhost/test');

        const element = document.getElementById('link')!;
        recorder.captureClick(element);

        const step = recorder.getCapturedSteps()[1];
        expect(step.event).toBe('click');
        expect(step.bundle.tag).toBe('a');
      });

      it('should ignore elements with data-sammy-ignore', () => {
        const recorder = new Recorder('project-123');
        recorder.start('http://localhost/test');

        const element = document.querySelector('[data-sammy-ignore]')!;
        const captured = recorder.captureClick(element);

        expect(captured).toBe(false);
      });

      it('should not capture if recording not started', () => {
        const recorder = new Recorder('project-123');

        const element = document.getElementById('submit-btn')!;
        const captured = recorder.captureClick(element);

        expect(captured).toBe(false);
      });

      it('should not capture if clicks disabled', () => {
        const recorder = new Recorder('project-123', { captureClicks: false });
        recorder.start('http://localhost/test');

        const element = document.getElementById('submit-btn')!;
        const captured = recorder.captureClick(element);

        expect(captured).toBe(false);
      });
    });

    describe('captureInput', () => {
      it('should capture text input', async () => {
        vi.useFakeTimers();
        
        const recorder = new Recorder('project-123', { inputDebounce: 100 });
        recorder.start('http://localhost/test');

        const element = document.getElementById('username')! as HTMLInputElement;
        recorder.captureInput(element, 'testuser');

        // Fast-forward past debounce
        vi.advanceTimersByTime(150);

        expect(recorder.getCapturedSteps()).toHaveLength(2);
        
        const step = recorder.getCapturedSteps()[1];
        expect(step.event).toBe('input');
        expect(step.value).toBe('testuser');
        
        vi.useRealTimers();
      });

      it('should debounce rapid inputs', async () => {
        vi.useFakeTimers();
        
        const recorder = new Recorder('project-123', { inputDebounce: 100 });
        recorder.start('http://localhost/test');

        const element = document.getElementById('username')! as HTMLInputElement;
        
        // Rapid inputs
        recorder.captureInput(element, 't');
        vi.advanceTimersByTime(50);
        recorder.captureInput(element, 'te');
        vi.advanceTimersByTime(50);
        recorder.captureInput(element, 'test');
        vi.advanceTimersByTime(150);

        // Should only have one input step with final value
        expect(recorder.getCapturedSteps()).toHaveLength(2);
        expect(recorder.getCapturedSteps()[1].value).toBe('test');
        
        vi.useRealTimers();
      });

      it('should not capture non-input elements', () => {
        const recorder = new Recorder('project-123');
        recorder.start('http://localhost/test');

        const element = document.getElementById('submit-btn')!;
        const captured = recorder.captureInput(element, 'value');

        expect(captured).toBe(false);
      });
    });

    describe('captureEnter', () => {
      it('should capture enter key press', () => {
        const recorder = new Recorder('project-123');
        recorder.start('http://localhost/test');

        const element = document.getElementById('username')!;
        const captured = recorder.captureEnter(element);

        expect(captured).toBe(true);
        
        const step = recorder.getCapturedSteps()[1];
        expect(step.event).toBe('enter');
      });

      it('should not capture if enter disabled', () => {
        const recorder = new Recorder('project-123', { captureEnter: false });
        recorder.start('http://localhost/test');

        const element = document.getElementById('username')!;
        const captured = recorder.captureEnter(element);

        expect(captured).toBe(false);
      });
    });

    describe('captureFromEvent', () => {
      it('should capture click event', () => {
        const recorder = new Recorder('project-123');
        recorder.start('http://localhost/test');

        const element = document.getElementById('submit-btn')!;
        const event = new (window as any).MouseEvent('click', { bubbles: true });
        Object.defineProperty(event, 'target', { value: element });

        const captured = recorder.captureFromEvent(event);

        expect(captured).toBe(true);
      });

      it('should capture keydown Enter event', () => {
        const recorder = new Recorder('project-123');
        recorder.start('http://localhost/test');

        const element = document.getElementById('username')!;
        const event = new (window as any).KeyboardEvent('keydown', { key: 'Enter' });
        Object.defineProperty(event, 'target', { value: element });

        const captured = recorder.captureFromEvent(event);

        expect(captured).toBe(true);
      });
    });
  });

  // ==========================================================================
  // STEP MANAGEMENT
  // ==========================================================================

  describe('Step Management', () => {
    describe('deleteLastStep', () => {
      it('should delete last captured step', () => {
        const recorder = new Recorder('project-123');
        recorder.start('http://localhost/test');
        
        const element = document.getElementById('submit-btn')!;
        recorder.captureClick(element);
        
        expect(recorder.getCapturedSteps()).toHaveLength(2);

        const deleted = recorder.deleteLastStep();

        expect(deleted?.event).toBe('click');
        expect(recorder.getCapturedSteps()).toHaveLength(1);
      });

      it('should return null if no steps', () => {
        const recorder = new Recorder('project-123');
        const deleted = recorder.deleteLastStep();

        expect(deleted).toBeNull();
      });
    });

    describe('deleteStepAt', () => {
      it('should delete step at index', () => {
        const recorder = new Recorder('project-123');
        recorder.start('http://localhost/test');
        
        const btn = document.getElementById('submit-btn')!;
        const link = document.getElementById('link')!;
        recorder.captureClick(btn);
        recorder.captureClick(link);
        
        const deleted = recorder.deleteStepAt(1);

        expect(deleted?.event).toBe('click');
        expect(recorder.getCapturedSteps()).toHaveLength(2);
      });

      it('should return null for invalid index', () => {
        const recorder = new Recorder('project-123');
        recorder.start('http://localhost/test');

        expect(recorder.deleteStepAt(-1)).toBeNull();
        expect(recorder.deleteStepAt(99)).toBeNull();
      });
    });

    describe('getStepCount', () => {
      it('should return step count', () => {
        const recorder = new Recorder('project-123');
        recorder.start('http://localhost/test');
        
        expect(recorder.getStepCount()).toBe(1);
        
        const element = document.getElementById('submit-btn')!;
        recorder.captureClick(element);
        
        expect(recorder.getStepCount()).toBe(2);
      });

      it('should return 0 if not recording', () => {
        const recorder = new Recorder('project-123');
        expect(recorder.getStepCount()).toBe(0);
      });
    });
  });

  // ==========================================================================
  // CALLBACKS
  // ==========================================================================

  describe('Callbacks', () => {
    describe('onStepCaptured', () => {
      it('should call callback when step captured', () => {
        const recorder = new Recorder('project-123');
        const callback = vi.fn();
        recorder.onStepCaptured(callback);
        
        recorder.start('http://localhost/test');

        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith(
          expect.objectContaining({ event: 'open' }),
          0
        );
      });

      it('should return unsubscribe function', () => {
        const recorder = new Recorder('project-123');
        const callback = vi.fn();
        const unsubscribe = recorder.onStepCaptured(callback);
        
        unsubscribe();
        recorder.start('http://localhost/test');

        expect(callback).not.toHaveBeenCalled();
      });
    });

    describe('onStateChange', () => {
      it('should call callback on state change', () => {
        const recorder = new Recorder('project-123');
        const callback = vi.fn();
        recorder.onStateChange(callback);
        
        recorder.start('http://localhost/test');
        recorder.pause();
        recorder.resume();
        recorder.stop();

        expect(callback).toHaveBeenCalledTimes(4);
      });
    });
  });

  // ==========================================================================
  // SESSION
  // ==========================================================================

  describe('Session', () => {
    it('should return session info', () => {
      const recorder = new Recorder('project-123');
      recorder.start('http://localhost/test');

      const session = recorder.getSession();

      expect(session).not.toBeNull();
      expect(session?.projectId).toBe('project-123');
      expect(session?.startUrl).toBe('http://localhost/test');
      expect(session?.state).toBe('recording');
    });

    it('should return null when not recording', () => {
      const recorder = new Recorder('project-123');
      expect(recorder.getSession()).toBeNull();
    });
  });

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  describe('Utilities', () => {
    describe('createRecorder', () => {
      it('should create new recorder instance', () => {
        const recorder = createRecorder('project-123');
        expect(recorder).toBeInstanceOf(Recorder);
      });

      it('should accept config', () => {
        const recorder = createRecorder('project-123', { captureClicks: false });
        expect(recorder.getConfig().captureClicks).toBe(false);
      });
    });

    describe('shouldCaptureClickAs', () => {
      it('should return click for button', () => {
        const element = document.getElementById('submit-btn')!;
        expect(shouldCaptureClickAs(element)).toBe('click');
      });

      it('should return click for link', () => {
        const element = document.getElementById('link')!;
        expect(shouldCaptureClickAs(element)).toBe('click');
      });

      it('should return click for checkbox input', () => {
        const element = document.getElementById('remember')!;
        expect(shouldCaptureClickAs(element)).toBe('click');
      });
    });

    describe('shouldCaptureImmediately', () => {
      it('should return true for select', () => {
        const element = document.getElementById('role')!;
        expect(shouldCaptureImmediately(element)).toBe(true);
      });

      it('should return true for checkbox', () => {
        const element = document.getElementById('remember')!;
        expect(shouldCaptureImmediately(element)).toBe(true);
      });

      it('should return false for text input', () => {
        const element = document.getElementById('username')!;
        expect(shouldCaptureImmediately(element)).toBe(false);
      });
    });
  });

  // ==========================================================================
  // CONFIG
  // ==========================================================================

  describe('Configuration', () => {
    it('should update config', () => {
      const recorder = new Recorder('project-123');
      
      recorder.updateConfig({ inputDebounce: 1000 });

      expect(recorder.getConfig().inputDebounce).toBe(1000);
    });

    it('should merge with defaults', () => {
      const recorder = new Recorder('project-123', { inputDebounce: 1000 });
      const config = recorder.getConfig();

      expect(config.inputDebounce).toBe(1000);
      expect(config.captureClicks).toBe(true); // Default value
    });
  });

  // ==========================================================================
  // CLEANUP
  // ==========================================================================

  describe('Cleanup', () => {
    it('should destroy recorder', () => {
      const recorder = new Recorder('project-123');
      recorder.start('http://localhost/test');

      recorder.destroy();

      expect(recorder.isRecording()).toBe(false);
      expect(recorder.getSession()).toBeNull();
    });
  });
});
