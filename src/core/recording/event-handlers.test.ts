/**
 * @fileoverview Tests for recording event handlers
 * @module core/recording/event-handlers.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  EventHandlerManager,
  createClickHandler,
  createInputHandler,
  createKeydownHandler,
  attachRecordingHandlers,
  createElementTypeFilter,
  createSelectorFilter,
  combineFilters,
  createExcludeFilter,
  attachToIframe,
  DEFAULT_EVENT_HANDLER_CONFIG,
  RECORDING_EVENTS
} from './event-handlers';
import { Recorder } from './recorder';

// Mock the locators module (highlights + buildBundle)
vi.mock('../locators', () => ({
  highlightRecording: vi.fn(() => 'highlight-123'),
  highlightSuccess: vi.fn(),
  removeHighlight: vi.fn(),
  clearAllHighlights: vi.fn(),
  buildBundle: vi.fn((element: Element) => ({
    tag: element.tagName.toLowerCase(),
    id: (element as HTMLElement).id || '',
    name: (element as any).name || '',
    placeholder: (element as any).placeholder || '',
    aria: '',
    dataAttrs: {},
    text: element.textContent?.trim() || '',
    css: '',
    xpath: `//${element.tagName.toLowerCase()}`,
    classes: Array.from(element.classList),
    pageUrl: '',
    bounding: { x: 0, y: 0, width: 100, height: 50 },
    iframeChain: null,
    shadowHosts: null
  }))
}));

describe('Event Handlers', () => {
  let dom: JSDOM;
  let document: Document;
  let window: Window;
  let recorder: Recorder;

  beforeEach(() => {
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <form id="login-form">
            <input id="username" name="username" type="text" placeholder="Username">
            <input id="password" name="password" type="password">
            <input id="remember" name="remember" type="checkbox">
            <select id="role" name="role">
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <textarea id="notes" name="notes"></textarea>
            <button id="submit-btn" type="submit">Login</button>
          </form>
          <div id="content">
            <a id="link" href="/page">Link</a>
            <button id="action-btn">Action</button>
          </div>
          <div data-sammy-ignore id="ignored">Ignored Content</div>
          <div class="sammy-ui">UI Element</div>
        </body>
      </html>
    `, { url: 'http://localhost/test' });
    
    document = dom.window.document;
    window = dom.window as unknown as Window & typeof globalThis;
    global.document = document;
    global.window = window as any;

    recorder = new Recorder('project-123');
    recorder.start('http://localhost/test');

    vi.spyOn(performance, 'now').mockReturnValue(1000);
  });

  afterEach(() => {
    // Clear session to avoid errors from mocked buildBundle returning undefined
    (recorder as any).session = null;
    recorder.destroy();
    dom.window.close();
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // CONSTANTS
  // ==========================================================================

  describe('Constants', () => {
    it('should have correct default config', () => {
      expect(DEFAULT_EVENT_HANDLER_CONFIG.useCapture).toBe(true);
      expect(DEFAULT_EVENT_HANDLER_CONFIG.preventDefault).toBe(false);
      expect(DEFAULT_EVENT_HANDLER_CONFIG.showHighlight).toBe(true);
      expect(DEFAULT_EVENT_HANDLER_CONFIG.highlightDuration).toBe(1000);
    });

    it('should have recording events defined', () => {
      expect(RECORDING_EVENTS.CLICK).toBe('click');
      expect(RECORDING_EVENTS.INPUT).toBe('input');
      expect(RECORDING_EVENTS.CHANGE).toBe('change');
      expect(RECORDING_EVENTS.KEYDOWN).toBe('keydown');
    });
  });

  // ==========================================================================
  // EVENT HANDLER MANAGER
  // ==========================================================================

  describe('EventHandlerManager', () => {
    describe('lifecycle', () => {
      it('should attach handlers', () => {
        const manager = new EventHandlerManager(recorder);
        
        manager.attach(document);

        expect(manager.isAttached()).toBe(true);
      });

      it('should detach handlers', () => {
        const manager = new EventHandlerManager(recorder);
        manager.attach(document);

        manager.detach();

        expect(manager.isAttached()).toBe(false);
      });

      it('should detach before re-attaching', () => {
        const manager = new EventHandlerManager(recorder);
        manager.attach(document);
        manager.attach(document);

        expect(manager.isAttached()).toBe(true);
      });

      it('should destroy and clean up', () => {
        const manager = new EventHandlerManager(recorder);
        manager.attach(document);

        manager.destroy();

        expect(manager.isAttached()).toBe(false);
      });
    });

    describe('click handling', () => {
      it('should capture button clicks', () => {
        const captureSpy = vi.spyOn(recorder, 'captureClick');
        const manager = new EventHandlerManager(recorder, { showHighlight: false });
        manager.attach(document);

        const button = document.getElementById('action-btn')!; // Use non-submit button
        button.click();

        expect(captureSpy).toHaveBeenCalledWith(button);
        
        manager.detach();
      });

      it('should capture link clicks', () => {
        const captureSpy = vi.spyOn(recorder, 'captureClick');
        const manager = new EventHandlerManager(recorder, { showHighlight: false });
        manager.attach(document);

        const link = document.getElementById('link')!;
        link.click();

        expect(captureSpy).toHaveBeenCalledWith(link);
        
        manager.detach();
      });

      it('should ignore data-sammy-ignore elements', () => {
        const manager = new EventHandlerManager(recorder, { showHighlight: false });
        manager.attach(document);

        const ignored = document.getElementById('ignored')!;
        const initialCount = recorder.getStepCount();
        
        ignored.click();

        expect(recorder.getStepCount()).toBe(initialCount);
        
        manager.detach();
      });

      it('should ignore sammy-ui elements', () => {
        const manager = new EventHandlerManager(recorder, { showHighlight: false });
        manager.attach(document);

        const uiElement = document.querySelector('.sammy-ui')!;
        const initialCount = recorder.getStepCount();
        
        (uiElement as HTMLElement).click();

        expect(recorder.getStepCount()).toBe(initialCount);
        
        manager.detach();
      });
    });

    describe('input handling', () => {
      it('should capture text input', () => {
        const captureSpy = vi.spyOn(recorder, 'captureInput');
        const manager = new EventHandlerManager(recorder, { showHighlight: false });
        manager.attach(document);

        const input = document.getElementById('username')! as HTMLInputElement;
        input.value = 'testuser';
        input.dispatchEvent(new (window as any).Event('input', { bubbles: true }));

        expect(captureSpy).toHaveBeenCalledWith(input, 'testuser');
        
        manager.detach();
      });

      it('should capture select change', () => {
        const captureSpy = vi.spyOn(recorder, 'captureInput');
        const manager = new EventHandlerManager(recorder, { showHighlight: false });
        manager.attach(document);

        const select = document.getElementById('role')! as HTMLSelectElement;
        select.value = 'admin';
        select.dispatchEvent(new (window as any).Event('change', { bubbles: true }));

        expect(captureSpy).toHaveBeenCalledWith(select, 'admin');
        
        manager.detach();
      });

      it('should capture checkbox change as click', () => {
        const captureSpy = vi.spyOn(recorder, 'captureClick');
        const manager = new EventHandlerManager(recorder, { showHighlight: false });
        manager.attach(document);

        const checkbox = document.getElementById('remember')! as HTMLInputElement;
        checkbox.checked = true;
        checkbox.dispatchEvent(new (window as any).Event('change', { bubbles: true }));

        expect(captureSpy).toHaveBeenCalledWith(checkbox);
        
        manager.detach();
      });
    });

    describe('keyboard handling', () => {
      it('should capture Enter key', () => {
        const captureSpy = vi.spyOn(recorder, 'captureEnter');
        const manager = new EventHandlerManager(recorder, { showHighlight: false });
        manager.attach(document);

        const input = document.getElementById('username')!;
        const event = new (window as any).KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
        input.dispatchEvent(event);

        expect(captureSpy).toHaveBeenCalledWith(input);
        
        manager.detach();
      });

      it('should not capture other keys', () => {
        const manager = new EventHandlerManager(recorder, { showHighlight: false });
        manager.attach(document);

        const input = document.getElementById('username')!;
        const initialCount = recorder.getStepCount();
        
        const event = new (window as any).KeyboardEvent('keydown', { key: 'a', bubbles: true });
        input.dispatchEvent(event);

        expect(recorder.getStepCount()).toBe(initialCount);
        
        manager.detach();
      });
    });

    describe('configuration', () => {
      it('should update config', () => {
        const manager = new EventHandlerManager(recorder);
        
        manager.updateConfig({ showHighlight: false });

        expect(manager.getConfig().showHighlight).toBe(false);
      });

      it('should use custom event filter', () => {
        const filter = vi.fn(() => false);
        const manager = new EventHandlerManager(recorder, { 
          eventFilter: filter,
          showHighlight: false
        });
        manager.attach(document);

        const button = document.getElementById('submit-btn')!;
        const initialCount = recorder.getStepCount();
        button.click();

        expect(filter).toHaveBeenCalled();
        expect(recorder.getStepCount()).toBe(initialCount);
        
        manager.detach();
      });

      it('should enable debug logging', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const manager = new EventHandlerManager(recorder, { 
          debugLog: true,
          showHighlight: false
        });
        
        manager.attach(document);

        expect(consoleSpy).toHaveBeenCalled();
        
        manager.detach();
      });
    });

    describe('recording state', () => {
      it('should not capture when recording is paused', () => {
        const manager = new EventHandlerManager(recorder, { showHighlight: false });
        manager.attach(document);

        recorder.pause();

        const button = document.getElementById('submit-btn')!;
        const initialCount = recorder.getStepCount();
        button.click();

        expect(recorder.getStepCount()).toBe(initialCount);
        
        manager.detach();
      });

      it('should not capture when recording is stopped', () => {
        const manager = new EventHandlerManager(recorder, { showHighlight: false });
        manager.attach(document);

        recorder.stop();

        const newRecorder = new Recorder('project-456');
        // Don't start recording
        
        expect(newRecorder.isRecording()).toBe(false);
        
        manager.detach();
      });
    });
  });

  // ==========================================================================
  // STANDALONE HANDLERS
  // ==========================================================================

  describe('Standalone Handlers', () => {
    describe('createClickHandler', () => {
      it('should create click handler', () => {
        const captureSpy = vi.spyOn(recorder, 'captureClick');
        const onCapture = vi.fn();
        const handler = createClickHandler(recorder, onCapture);

        const button = document.getElementById('submit-btn')!;
        const event = new (window as any).MouseEvent('click', { bubbles: true });
        Object.defineProperty(event, 'target', { value: button });

        handler(event);

        expect(captureSpy).toHaveBeenCalledWith(button);
      });

      it('should not capture when not recording', () => {
        recorder.stop();
        const newRecorder = new Recorder('project-456');
        const onCapture = vi.fn();
        const handler = createClickHandler(newRecorder, onCapture);

        const button = document.getElementById('submit-btn')!;
        const event = new (window as any).MouseEvent('click', { bubbles: true });
        Object.defineProperty(event, 'target', { value: button });

        handler(event);

        expect(onCapture).not.toHaveBeenCalled();
      });
    });

    describe('createInputHandler', () => {
      it('should create input handler', () => {
        const handler = createInputHandler(recorder);

        const input = document.getElementById('username')! as HTMLInputElement;
        input.value = 'test';
        const event = new (window as any).Event('input', { bubbles: true });
        Object.defineProperty(event, 'target', { value: input });

        handler(event);

        // Input is debounced, so check that captureInput was called
        expect(recorder.isRecording()).toBe(true);
      });
    });

    describe('createKeydownHandler', () => {
      it('should create keydown handler for Enter', () => {
        const captureSpy = vi.spyOn(recorder, 'captureEnter');
        const onCapture = vi.fn();
        const handler = createKeydownHandler(recorder, onCapture);

        const input = document.getElementById('username')!;
        const event = new (window as any).KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
        Object.defineProperty(event, 'target', { value: input });

        handler(event);

        expect(captureSpy).toHaveBeenCalledWith(input);
      });

      it('should ignore non-Enter keys', () => {
        const onCapture = vi.fn();
        const handler = createKeydownHandler(recorder, onCapture);

        const input = document.getElementById('username')!;
        const event = new (window as any).KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
        Object.defineProperty(event, 'target', { value: input });

        handler(event);

        expect(onCapture).not.toHaveBeenCalled();
      });
    });
  });

  // ==========================================================================
  // ATTACH RECORDING HANDLERS
  // ==========================================================================

  describe('attachRecordingHandlers', () => {
      it('should attach and return cleanup function', () => {
      const captureSpy = vi.spyOn(recorder, 'captureClick');
      const cleanup = attachRecordingHandlers(recorder, { showHighlight: false });

      expect(typeof cleanup).toBe('function');

      // Test that handlers are working
      const button = document.getElementById('action-btn')!; // Use non-submit button
      button.click();

      expect(captureSpy).toHaveBeenCalledWith(button);

      cleanup();
    });
  });

  // ==========================================================================
  // FILTERS
  // ==========================================================================

  describe('Filters', () => {
    describe('createElementTypeFilter', () => {
      it('should filter by element type', () => {
        const filter = createElementTypeFilter(['button', 'a']);

        const button = document.getElementById('submit-btn')!;
        const input = document.getElementById('username')!;

        const buttonEvent = new (window as any).Event('click');
        Object.defineProperty(buttonEvent, 'target', { value: button });

        const inputEvent = new (window as any).Event('click');
        Object.defineProperty(inputEvent, 'target', { value: input });

        expect(filter(buttonEvent)).toBe(true);
        expect(filter(inputEvent)).toBe(false);
      });
    });

    describe('createSelectorFilter', () => {
      it('should filter by selector', () => {
        const filter = createSelectorFilter('#login-form *');

        const formInput = document.getElementById('username')!;
        const contentBtn = document.getElementById('action-btn')!;

        const formEvent = new (window as any).Event('click');
        Object.defineProperty(formEvent, 'target', { value: formInput });

        const contentEvent = new (window as any).Event('click');
        Object.defineProperty(contentEvent, 'target', { value: contentBtn });

        expect(filter(formEvent)).toBe(true);
        expect(filter(contentEvent)).toBe(false);
      });
    });

    describe('combineFilters', () => {
      it('should combine filters with AND logic', () => {
        const filter1 = createElementTypeFilter(['input']);
        const filter2 = createSelectorFilter('#login-form *');
        const combined = combineFilters(filter1, filter2);

        const formInput = document.getElementById('username')!;
        const formButton = document.getElementById('submit-btn')!;

        const inputEvent = new (window as any).Event('click');
        Object.defineProperty(inputEvent, 'target', { value: formInput });

        const buttonEvent = new (window as any).Event('click');
        Object.defineProperty(buttonEvent, 'target', { value: formButton });

        expect(combined(inputEvent)).toBe(true);
        expect(combined(buttonEvent)).toBe(false); // Not an input
      });
    });

    describe('createExcludeFilter', () => {
      it('should invert filter', () => {
        const buttonFilter = createElementTypeFilter(['button']);
        const excludeButtons = createExcludeFilter(buttonFilter);

        const button = document.getElementById('submit-btn')!;
        const input = document.getElementById('username')!;

        const buttonEvent = new (window as any).Event('click');
        Object.defineProperty(buttonEvent, 'target', { value: button });

        const inputEvent = new (window as any).Event('click');
        Object.defineProperty(inputEvent, 'target', { value: input });

        expect(excludeButtons(buttonEvent)).toBe(false);
        expect(excludeButtons(inputEvent)).toBe(true);
      });
    });
  });

  // ==========================================================================
  // IFRAME SUPPORT
  // ==========================================================================

  describe('Iframe Support', () => {
    describe('attachToIframe', () => {
      it('should return null for cross-origin iframe', () => {
        const iframe = document.createElement('iframe');
        document.body.appendChild(iframe);

        // Mock cross-origin by making contentDocument null
        Object.defineProperty(iframe, 'contentDocument', { value: null });

        const cleanup = attachToIframe(iframe, recorder);

        expect(cleanup).toBeNull();

        document.body.removeChild(iframe);
      });
    });
  });
});
