/**
 * Tests for IBackgroundService types and helpers
 * @module core/background/IBackgroundService.test
 */

import { describe, it, expect } from 'vitest';
import {
  ACTION_CATEGORIES,
  isStorageAction,
  isTabAction,
  isRecordingAction,
  isReplayAction,
  getActionCategory,
  createSuccessResponse,
  createErrorResponse,
  type BackgroundMessage,
  type BackgroundResponse,
  type StorageAction,
  type TabAction,
  type RecordingAction,
  type ReplayAction,
  type TrackedTab,
  type BackgroundServiceState,
} from './IBackgroundService';

// ============================================================================
// ACTION CATEGORY TESTS
// ============================================================================

describe('ACTION_CATEGORIES', () => {
  it('should have storage actions', () => {
    expect(ACTION_CATEGORIES.storage).toContain('add_project');
    expect(ACTION_CATEGORIES.storage).toContain('get_all_projects');
    expect(ACTION_CATEGORIES.storage).toContain('createTestRun');
  });
  
  it('should have tab actions', () => {
    expect(ACTION_CATEGORIES.tab).toContain('openTab');
    expect(ACTION_CATEGORIES.tab).toContain('close_opened_tab');
    expect(ACTION_CATEGORIES.tab).toContain('injectScript');
  });
  
  it('should have recording actions', () => {
    expect(ACTION_CATEGORIES.recording).toContain('start_recording');
    expect(ACTION_CATEGORIES.recording).toContain('stop_recording');
    expect(ACTION_CATEGORIES.recording).toContain('logEvent');
  });
  
  it('should have replay actions', () => {
    expect(ACTION_CATEGORIES.replay).toContain('start_replay');
    expect(ACTION_CATEGORIES.replay).toContain('stop_replay');
    expect(ACTION_CATEGORIES.replay).toContain('step_result');
  });
});

// ============================================================================
// ACTION TYPE GUARD TESTS
// ============================================================================

describe('isStorageAction', () => {
  it('should return true for storage actions', () => {
    expect(isStorageAction('add_project')).toBe(true);
    expect(isStorageAction('get_all_projects')).toBe(true);
    expect(isStorageAction('createTestRun')).toBe(true);
  });
  
  it('should return false for non-storage actions', () => {
    expect(isStorageAction('openTab')).toBe(false);
    expect(isStorageAction('start_recording')).toBe(false);
    expect(isStorageAction('unknown_action')).toBe(false);
  });
});

describe('isTabAction', () => {
  it('should return true for tab actions', () => {
    expect(isTabAction('openTab')).toBe(true);
    expect(isTabAction('close_opened_tab')).toBe(true);
    expect(isTabAction('injectScript')).toBe(true);
  });
  
  it('should return false for non-tab actions', () => {
    expect(isTabAction('add_project')).toBe(false);
    expect(isTabAction('start_recording')).toBe(false);
  });
});

describe('isRecordingAction', () => {
  it('should return true for recording actions', () => {
    expect(isRecordingAction('start_recording')).toBe(true);
    expect(isRecordingAction('stop_recording')).toBe(true);
    expect(isRecordingAction('logEvent')).toBe(true);
  });
  
  it('should return false for non-recording actions', () => {
    expect(isRecordingAction('openTab')).toBe(false);
    expect(isRecordingAction('start_replay')).toBe(false);
  });
});

describe('isReplayAction', () => {
  it('should return true for replay actions', () => {
    expect(isReplayAction('start_replay')).toBe(true);
    expect(isReplayAction('stop_replay')).toBe(true);
    expect(isReplayAction('step_result')).toBe(true);
  });
  
  it('should return false for non-replay actions', () => {
    expect(isReplayAction('start_recording')).toBe(false);
    expect(isReplayAction('openTab')).toBe(false);
  });
});

// ============================================================================
// GET ACTION CATEGORY TESTS
// ============================================================================

describe('getActionCategory', () => {
  it('should return correct category for storage actions', () => {
    expect(getActionCategory('add_project')).toBe('storage');
    expect(getActionCategory('createTestRun')).toBe('storage');
  });
  
  it('should return correct category for tab actions', () => {
    expect(getActionCategory('openTab')).toBe('tab');
    expect(getActionCategory('close_opened_tab')).toBe('tab');
  });
  
  it('should return correct category for recording actions', () => {
    expect(getActionCategory('start_recording')).toBe('recording');
    expect(getActionCategory('logEvent')).toBe('recording');
  });
  
  it('should return correct category for replay actions', () => {
    expect(getActionCategory('start_replay')).toBe('replay');
    expect(getActionCategory('step_result')).toBe('replay');
  });
  
  it('should return null for unknown actions', () => {
    expect(getActionCategory('unknown_action')).toBeNull();
    expect(getActionCategory('')).toBeNull();
  });
});

// ============================================================================
// RESPONSE HELPER TESTS
// ============================================================================

describe('createSuccessResponse', () => {
  it('should create success response without data', () => {
    const response = createSuccessResponse();
    
    expect(response.success).toBe(true);
    expect(response.error).toBeUndefined();
  });
  
  it('should create success response with data', () => {
    const response = createSuccessResponse({ id: 42, name: 'Test' });
    
    expect(response.success).toBe(true);
    expect(response.id).toBe(42);
    expect(response.name).toBe('Test');
  });
  
  it('should create success response with array data', () => {
    const response = createSuccessResponse({ projects: [{ id: 1 }, { id: 2 }] });
    
    expect(response.success).toBe(true);
    expect(response.projects).toHaveLength(2);
  });
});

describe('createErrorResponse', () => {
  it('should create error response from string', () => {
    const response = createErrorResponse('Something went wrong');
    
    expect(response.success).toBe(false);
    expect(response.error).toBe('Something went wrong');
  });
  
  it('should create error response from Error object', () => {
    const response = createErrorResponse(new Error('Test error'));
    
    expect(response.success).toBe(false);
    expect(response.error).toBe('Test error');
  });
});

// ============================================================================
// TYPE VALIDATION TESTS
// ============================================================================

describe('type definitions', () => {
  describe('BackgroundMessage', () => {
    it('should accept valid message structure', () => {
      const message: BackgroundMessage = {
        action: 'add_project',
        payload: { name: 'Test' },
      };
      
      expect(message.action).toBe('add_project');
      expect(message.payload).toBeDefined();
    });
    
    it('should accept message with extra properties', () => {
      const message: BackgroundMessage = {
        action: 'openTab',
        url: 'https://example.com',
      };
      
      expect(message.url).toBe('https://example.com');
    });
  });
  
  describe('BackgroundResponse', () => {
    it('should accept success response', () => {
      const response: BackgroundResponse = {
        success: true,
        data: { id: 1 },
      };
      
      expect(response.success).toBe(true);
    });
    
    it('should accept error response', () => {
      const response: BackgroundResponse = {
        success: false,
        error: 'Failed',
      };
      
      expect(response.success).toBe(false);
      expect(response.error).toBe('Failed');
    });
  });
  
  describe('TrackedTab', () => {
    it('should have required properties', () => {
      const tab: TrackedTab = {
        tabId: 123,
        url: 'https://example.com',
        scriptInjected: true,
        createdAt: Date.now(),
        lastActivity: Date.now(),
      };
      
      expect(tab.tabId).toBe(123);
      expect(tab.scriptInjected).toBe(true);
    });
    
    it('should accept optional projectId', () => {
      const tab: TrackedTab = {
        tabId: 123,
        url: 'https://example.com',
        projectId: 42,
        scriptInjected: true,
        createdAt: Date.now(),
        lastActivity: Date.now(),
      };
      
      expect(tab.projectId).toBe(42);
    });
  });
  
  describe('BackgroundServiceState', () => {
    it('should have all state fields', () => {
      const state: BackgroundServiceState = {
        initialized: true,
        recordingProjectId: 42,
        isRecording: true,
        replayingProjectId: null,
        isReplaying: false,
        trackedTabCount: 3,
        openedTabId: 123,
      };
      
      expect(state.initialized).toBe(true);
      expect(state.isRecording).toBe(true);
      expect(state.trackedTabCount).toBe(3);
    });
  });
});

// ============================================================================
// ACTION TYPE TESTS
// ============================================================================

describe('action types', () => {
  it('should have consistent storage action names', () => {
    const actions: StorageAction[] = [
      'add_project',
      'update_project',
      'get_all_projects',
      'delete_project',
      'get_project_by_id',
      'update_project_steps',
      'update_project_fields',
      'update_project_csv',
      'createTestRun',
      'updateTestRun',
      'getTestRunsByProject',
    ];
    
    for (const action of actions) {
      expect(isStorageAction(action)).toBe(true);
    }
  });
  
  it('should have consistent tab action names', () => {
    const actions: TabAction[] = [
      'openTab',
      'close_opened_tab',
      'open_project_url_and_inject',
      'injectScript',
      'openDashBoard',
    ];
    
    for (const action of actions) {
      expect(isTabAction(action)).toBe(true);
    }
  });
  
  it('should have consistent recording action names', () => {
    const actions: RecordingAction[] = [
      'start_recording',
      'stop_recording',
      'logEvent',
    ];
    
    for (const action of actions) {
      expect(isRecordingAction(action)).toBe(true);
    }
  });
  
  it('should have consistent replay action names', () => {
    const actions: ReplayAction[] = [
      'start_replay',
      'stop_replay',
      'step_result',
    ];
    
    for (const action of actions) {
      expect(isReplayAction(action)).toBe(true);
    }
  });
});
