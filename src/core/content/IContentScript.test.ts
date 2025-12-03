/**
 * Tests for IContentScript types and helpers
 * @module core/content/IContentScript.test
 */

import { describe, it, expect } from 'vitest';
import {
  // Types
  type ContentScriptMode,
  type ContentScriptState,
  type RecordingState,
  type ReplayState,
  type RecordedEventType,
  type RecordedEvent,
  type IframeInfo,
  type ContentToExtensionMessage,
  type ExtensionToContentMessage,
  type PageContextMessage,
  type StepExecutionRequest,
  type StepExecutionResponse,
  type NotificationConfig,
  type NotificationType,
  
  // Constants
  DEFAULT_STEP_TIMEOUT,
  DEFAULT_NOTIFICATION_DURATION,
  PAGE_SCRIPT_SOURCE,
  CONTENT_SCRIPT_SOURCE,
  INPUT_EVENT_TYPES,
  CLICK_EVENT_TYPES,
  
  // Helper functions
  isInputEventType,
  isClickEventType,
  createEmptyRecordingState,
  createEmptyReplayState,
  createInitialContentState,
  createRecordedEvent,
  createStepResponse,
  serializeIframeChain,
  createContentMessage,
  createNotification,
} from './IContentScript';

import { createBundle } from '../types/locator-bundle';

// ============================================================================
// CONSTANTS TESTS
// ============================================================================

describe('Constants', () => {
  describe('DEFAULT_STEP_TIMEOUT', () => {
    it('should be 30 seconds', () => {
      expect(DEFAULT_STEP_TIMEOUT).toBe(30000);
    });
  });
  
  describe('DEFAULT_NOTIFICATION_DURATION', () => {
    it('should be 3 seconds', () => {
      expect(DEFAULT_NOTIFICATION_DURATION).toBe(3000);
    });
  });
  
  describe('Source identifiers', () => {
    it('should have page script source', () => {
      expect(PAGE_SCRIPT_SOURCE).toBe('anthropic-auto-allow-page');
    });
    
    it('should have content script source', () => {
      expect(CONTENT_SCRIPT_SOURCE).toBe('anthropic-auto-allow-content');
    });
  });
  
  describe('INPUT_EVENT_TYPES', () => {
    it('should include input events', () => {
      expect(INPUT_EVENT_TYPES).toContain('input');
      expect(INPUT_EVENT_TYPES).toContain('change');
      expect(INPUT_EVENT_TYPES).toContain('select');
      expect(INPUT_EVENT_TYPES).toContain('autocomplete_input');
    });
    
    it('should not include click events', () => {
      expect(INPUT_EVENT_TYPES).not.toContain('click');
    });
  });
  
  describe('CLICK_EVENT_TYPES', () => {
    it('should include click events', () => {
      expect(CLICK_EVENT_TYPES).toContain('click');
      expect(CLICK_EVENT_TYPES).toContain('enter');
      expect(CLICK_EVENT_TYPES).toContain('submit');
    });
    
    it('should not include input events', () => {
      expect(CLICK_EVENT_TYPES).not.toContain('input');
    });
  });
});

// ============================================================================
// HELPER FUNCTION TESTS
// ============================================================================

describe('Helper Functions', () => {
  describe('isInputEventType', () => {
    it('should return true for input events', () => {
      expect(isInputEventType('input')).toBe(true);
      expect(isInputEventType('change')).toBe(true);
      expect(isInputEventType('select')).toBe(true);
    });
    
    it('should return false for click events', () => {
      expect(isInputEventType('click')).toBe(false);
      expect(isInputEventType('enter')).toBe(false);
    });
  });
  
  describe('isClickEventType', () => {
    it('should return true for click events', () => {
      expect(isClickEventType('click')).toBe(true);
      expect(isClickEventType('enter')).toBe(true);
      expect(isClickEventType('submit')).toBe(true);
    });
    
    it('should return false for input events', () => {
      expect(isClickEventType('input')).toBe(false);
      expect(isClickEventType('change')).toBe(false);
    });
  });
  
  describe('createEmptyRecordingState', () => {
    it('should create inactive recording state', () => {
      const state = createEmptyRecordingState();
      
      expect(state.active).toBe(false);
      expect(state.eventsCaptured).toBe(0);
      expect(state.lastEventTime).toBeUndefined();
      expect(state.projectId).toBeUndefined();
    });
  });
  
  describe('createEmptyReplayState', () => {
    it('should create inactive replay state', () => {
      const state = createEmptyReplayState();
      
      expect(state.active).toBe(false);
      expect(state.currentStep).toBe(0);
      expect(state.totalSteps).toBe(0);
      expect(state.completedSteps).toBe(0);
      expect(state.failedSteps).toBe(0);
    });
  });
  
  describe('createInitialContentState', () => {
    it('should create idle state', () => {
      const state = createInitialContentState();
      
      expect(state.mode).toBe('idle');
      expect(state.initialized).toBe(false);
      expect(state.attachedIframes).toBe(0);
      expect(state.interceptorInjected).toBe(false);
    });
  });
  
  describe('createRecordedEvent', () => {
    it('should create event with bundle', () => {
      const bundle = createBundle({
        xpath: '//button',
        tag: 'button',
      });
      
      const event = createRecordedEvent('click', bundle, {
        label: 'Submit',
        x: 100,
        y: 200,
      });
      
      expect(event.eventType).toBe('click');
      expect(event.xpath).toBe('//button');
      expect(event.label).toBe('Submit');
      expect(event.x).toBe(100);
      expect(event.y).toBe(200);
      expect(event.timestamp).toBeGreaterThan(0);
    });
    
    it('should use defaults for optional fields', () => {
      const bundle = createBundle({ tag: 'input' });
      
      const event = createRecordedEvent('input', bundle);
      
      expect(event.value).toBe('');
      expect(event.label).toBe('');
      expect(event.x).toBeUndefined();
      expect(event.y).toBeUndefined();
    });
    
    it('should include iframe chain', () => {
      const bundle = createBundle({ tag: 'input' });
      const iframeChain: IframeInfo[] = [
        { index: 0, id: 'frame1' },
        { index: 1, id: 'frame2' },
      ];
      
      const event = createRecordedEvent('input', bundle, { iframeChain });
      
      expect(event.iframeChain).toEqual(iframeChain);
    });
  });
  
  describe('createStepResponse', () => {
    it('should create success response', () => {
      const response = createStepResponse(true, 150, {
        strategyUsed: 'id',
      });
      
      expect(response.success).toBe(true);
      expect(response.duration).toBe(150);
      expect(response.elementFound).toBe(true);
      expect(response.strategyUsed).toBe('id');
    });
    
    it('should create failure response', () => {
      const response = createStepResponse(false, 5000, {
        error: 'Element not found',
        elementFound: false,
      });
      
      expect(response.success).toBe(false);
      expect(response.error).toBe('Element not found');
      expect(response.elementFound).toBe(false);
    });
    
    it('should default elementFound to success value', () => {
      expect(createStepResponse(true, 100).elementFound).toBe(true);
      expect(createStepResponse(false, 100).elementFound).toBe(false);
    });
  });
  
  describe('serializeIframeChain', () => {
    it('should serialize empty chain', () => {
      const chain = serializeIframeChain([]);
      
      expect(chain).toEqual([]);
    });
    
    it('should serialize iframe properties', () => {
      // Create mock iframes
      const iframe1 = {
        src: 'https://example.com/frame1',
        id: 'frame1',
        name: 'Frame One',
      } as HTMLIFrameElement;
      
      const iframe2 = {
        src: 'https://example.com/frame2',
        id: '',
        name: '',
      } as HTMLIFrameElement;
      
      const chain = serializeIframeChain([iframe1, iframe2]);
      
      expect(chain).toHaveLength(2);
      expect(chain[0].index).toBe(0);
      expect(chain[0].src).toBe('https://example.com/frame1');
      expect(chain[0].id).toBe('frame1');
      expect(chain[0].name).toBe('Frame One');
      expect(chain[1].index).toBe(1);
      expect(chain[1].id).toBeUndefined(); // Empty string becomes undefined
    });
  });
  
  describe('createContentMessage', () => {
    it('should create message with data', () => {
      const message = createContentMessage('logEvent', { eventType: 'click' });
      
      expect(message.type).toBe('logEvent');
      expect(message.data).toEqual({ eventType: 'click' });
      expect(message.error).toBeUndefined();
    });
    
    it('should create error message', () => {
      const message = createContentMessage('error', null, 'Something went wrong');
      
      expect(message.type).toBe('error');
      expect(message.error).toBe('Something went wrong');
    });
  });
  
  describe('createNotification', () => {
    it('should create loading notification', () => {
      const notification = createNotification('loading', 'Please wait...', {
        showProgress: true,
        progress: 50,
      });
      
      expect(notification.type).toBe('loading');
      expect(notification.message).toBe('Please wait...');
      expect(notification.duration).toBe(0); // Loading doesn't auto-dismiss
      expect(notification.showProgress).toBe(true);
      expect(notification.progress).toBe(50);
    });
    
    it('should create success notification with default duration', () => {
      const notification = createNotification('success', 'Done!');
      
      expect(notification.type).toBe('success');
      expect(notification.duration).toBe(DEFAULT_NOTIFICATION_DURATION);
    });
    
    it('should create error notification with custom duration', () => {
      const notification = createNotification('error', 'Failed!', {
        duration: 5000,
      });
      
      expect(notification.type).toBe('error');
      expect(notification.duration).toBe(5000);
    });
  });
});

// ============================================================================
// TYPE DEFINITION TESTS
// ============================================================================

describe('Type Definitions', () => {
  describe('ContentScriptMode', () => {
    it('should accept valid modes', () => {
      const idle: ContentScriptMode = 'idle';
      const recording: ContentScriptMode = 'recording';
      const replaying: ContentScriptMode = 'replaying';
      
      expect(idle).toBe('idle');
      expect(recording).toBe('recording');
      expect(replaying).toBe('replaying');
    });
  });
  
  describe('ContentScriptState', () => {
    it('should accept valid state', () => {
      const state: ContentScriptState = {
        mode: 'idle',
        initialized: true,
        pageUrl: 'https://example.com',
        attachedIframes: 2,
        interceptorInjected: true,
      };
      
      expect(state.mode).toBe('idle');
      expect(state.initialized).toBe(true);
    });
    
    it('should accept state with recording/replay info', () => {
      const state: ContentScriptState = {
        mode: 'recording',
        initialized: true,
        pageUrl: 'https://example.com',
        attachedIframes: 0,
        interceptorInjected: false,
        recordingState: {
          active: true,
          eventsCaptured: 5,
          lastEventTime: Date.now(),
          projectId: 1,
        },
      };
      
      expect(state.recordingState?.active).toBe(true);
      expect(state.recordingState?.eventsCaptured).toBe(5);
    });
  });
  
  describe('RecordedEventType', () => {
    it('should include all event types', () => {
      const types: RecordedEventType[] = [
        'click',
        'input',
        'change',
        'enter',
        'select',
        'focus',
        'blur',
        'submit',
        'navigation',
        'autocomplete_input',
        'autocomplete_selection',
      ];
      
      expect(types).toHaveLength(11);
    });
  });
  
  describe('StepExecutionRequest', () => {
    it('should accept valid request', () => {
      const request: StepExecutionRequest = {
        step: {
          id: 'step-1',
          name: 'Click Submit',
          event: 'click',
          label: 'Submit',
          value: '',
          path: '//button',
          x: 0,
          y: 0,
          bundle: createBundle({ xpath: '//button', tag: 'button' }),
        },
        csvValues: { username: 'test' },
        fieldMappings: { username: 'Username' },
        timeout: 5000,
      };
      
      expect(request.step.event).toBe('click');
      expect(request.timeout).toBe(5000);
    });
  });
  
  describe('NotificationConfig', () => {
    it('should accept valid config', () => {
      const config: NotificationConfig = {
        type: 'success',
        message: 'Test passed!',
        duration: 3000,
        showProgress: false,
      };
      
      expect(config.type).toBe('success');
      expect(config.message).toBe('Test passed!');
    });
  });
  
  describe('ContentToExtensionMessage', () => {
    it('should accept valid message types', () => {
      const messages: ContentToExtensionMessage[] = [
        { type: 'logEvent', data: {} },
        { type: 'step_result', data: { success: true } },
        { type: 'recording_started' },
        { type: 'recording_stopped' },
        { type: 'replay_complete' },
        { type: 'content_script_ready' },
        { type: 'error', error: 'Something failed' },
      ];
      
      expect(messages).toHaveLength(7);
    });
  });
  
  describe('ExtensionToContentMessage', () => {
    it('should accept valid action types', () => {
      const messages: ExtensionToContentMessage[] = [
        { action: 'start_recording' },
        { action: 'stop_recording' },
        { action: 'execute_replay', payload: [] },
        { action: 'execute_step', payload: {} },
        { action: 'ping' },
        { action: 'get_state' },
        { action: 'inject_interceptor' },
      ];
      
      expect(messages).toHaveLength(7);
    });
  });
  
  describe('PageContextMessage', () => {
    it('should accept valid message types', () => {
      const messages: PageContextMessage[] = [
        { type: 'REPLAY_AUTOCOMPLETE', payload: {} },
        { type: 'AUTOCOMPLETE_INPUT', payload: { value: 'test' } },
        { type: 'AUTOCOMPLETE_SELECTION', payload: { text: 'Option 1' } },
        { type: 'SHADOW_ROOT_EXPOSED' },
        { type: 'PAGE_SCRIPT_READY', source: PAGE_SCRIPT_SOURCE },
        { type: 'EXECUTE_IN_PAGE', payload: {} },
      ];
      
      expect(messages).toHaveLength(6);
    });
  });
});
