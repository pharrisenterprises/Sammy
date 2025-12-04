/**
 * Tests for IBackgroundService type definitions
 * @module background/IBackgroundService.test
 */

import { describe, it, expect } from 'vitest';
import {
  isBackgroundMessage,
  isSuccessResponse,
  isErrorResponse,
  createSuccessResponse,
  createErrorResponse,
  createIdResponse,
  createTabResponse,
  ACTIONS,
  STATE_KEYS,
  DEFAULT_MAIN_SCRIPT,
  type BackgroundMessage,
  type BackgroundResponse,
  type TabState,
  type TabStatus,
} from './IBackgroundService';

// ============================================================================
// TYPE GUARD TESTS
// ============================================================================

describe('Type Guards', () => {
  describe('isBackgroundMessage', () => {
    it('should return true for valid message', () => {
      const message: BackgroundMessage = { action: 'test' };
      expect(isBackgroundMessage(message)).toBe(true);
    });

    it('should return true for message with payload', () => {
      const message = { action: 'test', payload: { data: 123 } };
      expect(isBackgroundMessage(message)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isBackgroundMessage(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isBackgroundMessage(undefined)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(isBackgroundMessage('string')).toBe(false);
      expect(isBackgroundMessage(123)).toBe(false);
    });

    it('should return false for object without action', () => {
      expect(isBackgroundMessage({ payload: {} })).toBe(false);
    });

    it('should return false for non-string action', () => {
      expect(isBackgroundMessage({ action: 123 })).toBe(false);
    });
  });

  describe('isSuccessResponse', () => {
    it('should return true for success response', () => {
      const response: BackgroundResponse = { success: true };
      expect(isSuccessResponse(response)).toBe(true);
    });

    it('should return true for success response with data', () => {
      const response: BackgroundResponse = { success: true, data: { test: 1 } };
      expect(isSuccessResponse(response)).toBe(true);
    });

    it('should return false for error response', () => {
      const response: BackgroundResponse = { success: false, error: 'fail' };
      expect(isSuccessResponse(response)).toBe(false);
    });
  });

  describe('isErrorResponse', () => {
    it('should return true for error response', () => {
      const response: BackgroundResponse = { success: false, error: 'fail' };
      expect(isErrorResponse(response)).toBe(true);
    });

    it('should return false for success response', () => {
      const response: BackgroundResponse = { success: true };
      expect(isErrorResponse(response)).toBe(false);
    });

    it('should return false for error without message', () => {
      const response = { success: false } as BackgroundResponse;
      expect(isErrorResponse(response)).toBe(false);
    });
  });
});

// ============================================================================
// RESPONSE FACTORY TESTS
// ============================================================================

describe('Response Factories', () => {
  describe('createSuccessResponse', () => {
    it('should create success response without data', () => {
      const response = createSuccessResponse();
      expect(response.success).toBe(true);
      expect(response.data).toBeUndefined();
    });

    it('should create success response with data', () => {
      const data = { projects: [] };
      const response = createSuccessResponse(data);
      expect(response.success).toBe(true);
      expect(response.data).toBe(data);
    });
  });

  describe('createErrorResponse', () => {
    it('should create error response', () => {
      const response = createErrorResponse('Something went wrong');
      expect(response.success).toBe(false);
      expect(response.error).toBe('Something went wrong');
    });
  });

  describe('createIdResponse', () => {
    it('should create response with ID', () => {
      const response = createIdResponse(42);
      expect(response.success).toBe(true);
      expect(response.id).toBe(42);
    });
  });

  describe('createTabResponse', () => {
    it('should create response with tab ID', () => {
      const response = createTabResponse(12345);
      expect(response.success).toBe(true);
      expect(response.tabId).toBe(12345);
    });
  });
});

// ============================================================================
// CONSTANTS TESTS
// ============================================================================

describe('Constants', () => {
  describe('ACTIONS', () => {
    it('should have project actions', () => {
      expect(ACTIONS.ADD_PROJECT).toBe('add_project');
      expect(ACTIONS.UPDATE_PROJECT).toBe('update_project');
      expect(ACTIONS.GET_ALL_PROJECTS).toBe('get_all_projects');
      expect(ACTIONS.DELETE_PROJECT).toBe('delete_project');
      expect(ACTIONS.GET_PROJECT_BY_ID).toBe('get_project_by_id');
    });

    it('should have test run actions', () => {
      expect(ACTIONS.CREATE_TEST_RUN).toBe('createTestRun');
      expect(ACTIONS.UPDATE_TEST_RUN).toBe('updateTestRun');
      expect(ACTIONS.GET_TEST_RUNS_BY_PROJECT).toBe('getTestRunsByProject');
    });

    it('should have tab actions', () => {
      expect(ACTIONS.OPEN_TAB).toBe('openTab');
      expect(ACTIONS.CLOSE_OPENED_TAB).toBe('close_opened_tab');
      expect(ACTIONS.OPEN_DASHBOARD).toBe('openDashBoard');
    });
  });

  describe('STATE_KEYS', () => {
    it('should have state keys', () => {
      expect(STATE_KEYS.OPENED_TAB_ID).toBe('openedTabId');
      expect(STATE_KEYS.TRACKED_TABS).toBe('trackedTabs');
      expect(STATE_KEYS.ACTIVE_PROJECT).toBe('activeProject');
    });
  });

  describe('DEFAULT_MAIN_SCRIPT', () => {
    it('should be js/main.js', () => {
      expect(DEFAULT_MAIN_SCRIPT).toBe('js/main.js');
    });
  });
});

// ============================================================================
// TYPE TESTS (Compile-time)
// ============================================================================

describe('Type Definitions', () => {
  it('should allow valid TabState', () => {
    const state: TabState = {
      tabId: 123,
      url: 'https://example.com',
      injected: true,
      openedAt: new Date(),
      status: 'ready',
    };
    expect(state.tabId).toBe(123);
  });

  it('should allow all TabStatus values', () => {
    const statuses: TabStatus[] = [
      'loading',
      'complete',
      'injecting',
      'ready',
      'error',
      'closed',
    ];
    expect(statuses.length).toBe(6);
  });

  it('should allow BackgroundMessage with optional fields', () => {
    const minimal: BackgroundMessage = { action: 'test' };
    const full: BackgroundMessage = {
      action: 'test',
      payload: { key: 'value' },
      requestId: 'req-123',
    };
    expect(minimal.action).toBe('test');
    expect(full.requestId).toBe('req-123');
  });
});
