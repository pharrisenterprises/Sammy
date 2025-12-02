/**
 * Tests for RecordingCoordinator
 * @module core/recording/RecordingCoordinator.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  RecordingCoordinator,
  createRecordingCoordinator,
  getRecordingCoordinator,
  resetRecordingCoordinator,
  startRecording,
  stopRecording,
  isRecording,
  getRecordedSteps,
  DEFAULT_RECORDING_CONFIG,
  type RecordingEvent,
  type RecordingState,
  type Step,
} from './RecordingCoordinator';

import { resetIframeHandler } from './IframeHandler';
import { resetShadowDomHandler } from './ShadowDomHandler';
import { resetInputChangeTracker } from './InputChangeTracker';
import { resetStepBuilder } from './StepBuilder';

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Create a test button
 */
function createButton(text: string = 'Click me'): HTMLButtonElement {
  const button = document.createElement('button');
  button.textContent = text;
  button.id = 'test-button';
  document.body.appendChild(button);
  return button;
}

/**
 * Create a test input
 */
function createInput(value: string = ''): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'test-input';
  input.value = value;
  input.placeholder = 'Enter text';
  document.body.appendChild(input);
  return input;
}

/**
 * Create a test checkbox
 */
function createCheckbox(checked: boolean = false): HTMLInputElement {
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = 'test-checkbox';
  checkbox.checked = checked;
  document.body.appendChild(checkbox);
  return checkbox;
}

/**
 * Create a test select
 */
function createSelect(): HTMLSelectElement {
  const select = document.createElement('select');
  select.id = 'test-select';
  
  ['Option A', 'Option B', 'Option C'].forEach((text, i) => {
    const option = document.createElement('option');
    option.value = `option${i}`;
    option.textContent = text;
    select.appendChild(option);
  });
  
  document.body.appendChild(select);
  return select;
}

/**
 * Simulate trusted mousedown event
 */
function simulateMouseDown(element: Element): void {
  const event = new MouseEvent('mousedown', {
    bubbles: true,
    cancelable: true,
  });
  
  element.dispatchEvent(event);
}

/**
 * Simulate trusted input event
 */
function simulateInput(element: HTMLInputElement, value: string): void {
  element.value = value;
  
  const event = new Event('input', { bubbles: true });
  element.dispatchEvent(event);
}

/**
 * Simulate trusted change event
 */
function simulateChange(element: Element): void {
  const event = new Event('change', { bubbles: true });
  element.dispatchEvent(event);
}

/**
 * Simulate trusted keydown event
 */
function simulateKeyDown(element: Element, key: string): void {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    key,
  });
  element.dispatchEvent(event);
}

/**
 * Reset all singletons
 */
function resetAll(): void {
  resetRecordingCoordinator();
  resetIframeHandler();
  resetShadowDomHandler();
  resetInputChangeTracker();
  resetStepBuilder();
}

// ============================================================================
// TESTS
// ============================================================================

describe('RecordingCoordinator', () => {
  let coordinator: RecordingCoordinator;
  
  beforeEach(() => {
    vi.useFakeTimers();
    resetAll();
    coordinator = new RecordingCoordinator({
      includeIframes: false,
      includeShadowDom: false,
      trustedEventsOnly: false, // Allow synthetic events in tests
    });
  });
  
  afterEach(async () => {
    await coordinator.stop();
    document.body.innerHTML = '';
    resetAll();
    vi.useRealTimers();
  });
  
  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================
  
  describe('lifecycle', () => {
    it('should start in idle state', () => {
      expect(coordinator.getState()).toBe('idle');
    });
    
    it('should transition to recording on start', async () => {
      await coordinator.start();
      
      expect(coordinator.getState()).toBe('recording');
      expect(coordinator.isRecording()).toBe(true);
    });
    
    it('should transition to stopped on stop', async () => {
      await coordinator.start();
      await coordinator.stop();
      
      expect(coordinator.getState()).toBe('stopped');
      expect(coordinator.isRecording()).toBe(false);
    });
    
    it('should transition to paused on pause', async () => {
      await coordinator.start();
      coordinator.pause();
      
      expect(coordinator.getState()).toBe('paused');
    });
    
    it('should transition to recording on resume', async () => {
      await coordinator.start();
      coordinator.pause();
      coordinator.resume();
      
      expect(coordinator.getState()).toBe('recording');
    });
    
    it('should throw when starting twice', async () => {
      await coordinator.start();
      
      await expect(coordinator.start()).rejects.toThrow();
    });
    
    it('should return steps on stop', async () => {
      await coordinator.start();
      
      const button = createButton();
      simulateMouseDown(button);
      
      const steps = await coordinator.stop();
      
      expect(steps.length).toBe(1);
    });
  });
  
  // ==========================================================================
  // CLICK RECORDING
  // ==========================================================================
  
  describe('click recording', () => {
    it('should record button click', async () => {
      await coordinator.start();
      
      const button = createButton('Submit');
      simulateMouseDown(button);
      
      expect(coordinator.getStepCount()).toBe(1);
      
      const steps = coordinator.getSteps();
      expect(steps[0].event).toBe('click');
    });
    
    it('should not record clicks when paused', async () => {
      await coordinator.start();
      coordinator.pause();
      
      const button = createButton();
      simulateMouseDown(button);
      
      expect(coordinator.getStepCount()).toBe(0);
    });
    
    it('should include label in step', async () => {
      await coordinator.start();
      
      const button = createButton('My Button');
      simulateMouseDown(button);
      
      const steps = coordinator.getSteps();
      expect(steps[0].label).toBeDefined();
    });
  });
  
  // ==========================================================================
  // INPUT RECORDING
  // ==========================================================================
  
  describe('input recording', () => {
    it('should record input after debounce', async () => {
      const debounceConfig = new RecordingCoordinator({
        includeIframes: false,
        includeShadowDom: false,
        trustedEventsOnly: false,
        inputDebounceDelay: 100,
      });
      
      await debounceConfig.start();
      
      const input = createInput();
      
      // Start tracking
      const inputTracker = debounceConfig['inputTracker'];
      inputTracker.startTracking(input);
      
      simulateInput(input, 'test');
      
      // Not recorded yet
      expect(debounceConfig.getStepCount()).toBe(0);
      
      // Advance past debounce
      vi.advanceTimersByTime(150);
      
      expect(debounceConfig.getStepCount()).toBe(1);
      
      const steps = debounceConfig.getSteps();
      expect(steps[0].event).toBe('input');
      expect(steps[0].value).toBe('test');
      
      await debounceConfig.stop();
    });
    
    it('should record checkbox immediately', async () => {
      await coordinator.start();
      
      const checkbox = createCheckbox();
      checkbox.checked = true;
      simulateChange(checkbox);
      
      expect(coordinator.getStepCount()).toBe(1);
      
      const steps = coordinator.getSteps();
      expect(steps[0].value).toBe('true');
    });
    
    it('should record select immediately', async () => {
      await coordinator.start();
      
      const select = createSelect();
      select.value = 'option1';
      simulateChange(select);
      
      expect(coordinator.getStepCount()).toBe(1);
      
      const steps = coordinator.getSteps();
      expect(steps[0].value).toBe('option1');
    });
  });
  
  // ==========================================================================
  // KEYBOARD RECORDING
  // ==========================================================================
  
  describe('keyboard recording', () => {
    it('should record Enter key', async () => {
      await coordinator.start();
      
      const input = createInput();
      simulateKeyDown(input, 'Enter');
      
      expect(coordinator.getStepCount()).toBe(1);
      
      const steps = coordinator.getSteps();
      expect(steps[0].event).toBe('enter');
    });
    
    it('should not record other keys', async () => {
      await coordinator.start();
      
      const input = createInput();
      simulateKeyDown(input, 'a');
      simulateKeyDown(input, 'Tab');
      simulateKeyDown(input, 'Escape');
      
      expect(coordinator.getStepCount()).toBe(0);
    });
  });
  
  // ==========================================================================
  // EVENT CALLBACKS
  // ==========================================================================
  
  describe('event callbacks', () => {
    it('should emit started event', async () => {
      const events: RecordingEvent[] = [];
      coordinator.addEventListener((event) => events.push(event));
      
      await coordinator.start();
      
      expect(events.some(e => e.type === 'started')).toBe(true);
    });
    
    it('should emit stopped event', async () => {
      const events: RecordingEvent[] = [];
      coordinator.addEventListener((event) => events.push(event));
      
      await coordinator.start();
      await coordinator.stop();
      
      expect(events.some(e => e.type === 'stopped')).toBe(true);
    });
    
    it('should emit step-recorded event', async () => {
      const events: RecordingEvent[] = [];
      coordinator.addEventListener((event) => events.push(event));
      
      await coordinator.start();
      
      const button = createButton();
      simulateMouseDown(button);
      
      const stepEvents = events.filter(e => e.type === 'step-recorded');
      expect(stepEvents.length).toBe(1);
      expect(stepEvents[0].step).toBeDefined();
    });
    
    it('should call onStep callback', async () => {
      const steps: Step[] = [];
      coordinator.onStep((step) => steps.push(step));
      
      await coordinator.start();
      
      const button = createButton();
      simulateMouseDown(button);
      
      expect(steps.length).toBe(1);
    });
    
    it('should allow unsubscribing', async () => {
      const events: RecordingEvent[] = [];
      const unsubscribe = coordinator.addEventListener((event) => events.push(event));
      
      await coordinator.start();
      unsubscribe();
      await coordinator.stop();
      
      // Should only have started event, not stopped
      expect(events.filter(e => e.type === 'stopped').length).toBe(0);
    });
  });
  
  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================
  
  describe('configuration', () => {
    it('should use default configuration', () => {
      const config = coordinator.getConfig();
      
      expect(config.highlightElements).toBe(DEFAULT_RECORDING_CONFIG.highlightElements);
      expect(config.highlightDuration).toBe(DEFAULT_RECORDING_CONFIG.highlightDuration);
    });
    
    it('should update configuration', () => {
      coordinator.setConfig({ highlightDuration: 1000 });
      
      expect(coordinator.getConfig().highlightDuration).toBe(1000);
    });
    
    it('should respect maxSteps', async () => {
      coordinator.setConfig({ maxSteps: 2 });
      await coordinator.start();
      
      const button = createButton();
      simulateMouseDown(button);
      simulateMouseDown(button);
      simulateMouseDown(button);
      
      expect(coordinator.getStepCount()).toBe(2);
    });
  });
  
  // ==========================================================================
  // STEP MANAGEMENT
  // ==========================================================================
  
  describe('step management', () => {
    it('should get steps', async () => {
      await coordinator.start();
      
      const button = createButton();
      simulateMouseDown(button);
      
      const steps = coordinator.getSteps();
      
      expect(steps.length).toBe(1);
    });
    
    it('should clear steps', async () => {
      await coordinator.start();
      
      const button = createButton();
      simulateMouseDown(button);
      
      coordinator.clearSteps();
      
      expect(coordinator.getStepCount()).toBe(0);
    });
    
    it('should track duration', async () => {
      await coordinator.start();
      
      vi.advanceTimersByTime(1000);
      
      expect(coordinator.getDuration()).toBeGreaterThanOrEqual(1000);
    });
  });
  
  // ==========================================================================
  // HIGHLIGHT
  // ==========================================================================
  
  describe('highlight', () => {
    it('should add highlight class', async () => {
      await coordinator.start();
      
      const button = createButton();
      simulateMouseDown(button);
      
      expect(button.classList.contains('recorder-highlight')).toBe(true);
    });
    
    it('should remove highlight class after duration', async () => {
      await coordinator.start();
      
      const button = createButton();
      simulateMouseDown(button);
      
      vi.advanceTimersByTime(600);
      
      expect(button.classList.contains('recorder-highlight')).toBe(false);
    });
    
    it('should not highlight when disabled', async () => {
      const noHighlight = new RecordingCoordinator({
        includeIframes: false,
        includeShadowDom: false,
        trustedEventsOnly: false,
        highlightElements: false,
      });
      
      await noHighlight.start();
      
      const button = createButton();
      simulateMouseDown(button);
      
      expect(button.classList.contains('recorder-highlight')).toBe(false);
      
      await noHighlight.stop();
    });
  });
});

// ============================================================================
// FACTORY FUNCTION TESTS
// ============================================================================

describe('createRecordingCoordinator', () => {
  afterEach(() => {
    resetAll();
    document.body.innerHTML = '';
  });
  
  it('should create coordinator with config', () => {
    const coordinator = createRecordingCoordinator({ maxSteps: 10 });
    expect(coordinator.getConfig().maxSteps).toBe(10);
  });
});

// ============================================================================
// SINGLETON TESTS
// ============================================================================

describe('singleton', () => {
  afterEach(() => {
    resetAll();
    document.body.innerHTML = '';
  });
  
  it('should return same instance', () => {
    const c1 = getRecordingCoordinator();
    const c2 = getRecordingCoordinator();
    
    expect(c1).toBe(c2);
  });
  
  it('should reset instance', async () => {
    const c1 = getRecordingCoordinator();
    await c1.start();
    resetRecordingCoordinator();
    const c2 = getRecordingCoordinator();
    
    expect(c1).not.toBe(c2);
    expect(c2.getState()).toBe('idle');
  });
});

// ============================================================================
// CONVENIENCE FUNCTION TESTS
// ============================================================================

describe('convenience functions', () => {
  beforeEach(() => {
    resetAll();
  });
  
  afterEach(async () => {
    await stopRecording();
    resetAll();
    document.body.innerHTML = '';
  });
  
  it('startRecording should start', async () => {
    await startRecording({
      includeIframes: false,
      includeShadowDom: false,
    });
    
    expect(isRecording()).toBe(true);
  });
  
  it('stopRecording should stop and return steps', async () => {
    await startRecording({
      includeIframes: false,
      includeShadowDom: false,
      trustedEventsOnly: false,
    });
    
    const button = document.createElement('button');
    document.body.appendChild(button);
    button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    
    const steps = await stopRecording();
    
    expect(isRecording()).toBe(false);
  });
  
  it('getRecordedSteps should return steps', async () => {
    await startRecording({
      includeIframes: false,
      includeShadowDom: false,
    });
    
    const steps = getRecordedSteps();
    
    expect(Array.isArray(steps)).toBe(true);
  });
});
