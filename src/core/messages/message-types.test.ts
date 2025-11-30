/**
 * @fileoverview Tests for Message type definitions
 * @module core/messages/message-types.test
 */

import { describe, it, expect } from 'vitest';
import {
  MESSAGE_ACTIONS,
  ALL_MESSAGE_ACTIONS,
  isMessageAction,
  isMessage,
  isSuccessResponse,
  isErrorResponse,
  generateRequestId,
  createMessage,
  createSuccessResponse,
  createErrorResponse,
  PROJECT_ACTIONS,
  STEP_ACTIONS,
  RECORDING_ACTIONS,
  REPLAY_ACTIONS,
  isProjectAction,
  isStepAction,
  isRecordingAction,
  isReplayAction,
  type GetAllProjectsMessage,
  type AddProjectPayload,
  type BaseResponse
} from './message-types';

describe('Message Types', () => {
  // ==========================================================================
  // CONSTANTS
  // ==========================================================================

  describe('MESSAGE_ACTIONS', () => {
    it('should use lowercase_snake_case for all actions', () => {
      const actions = Object.values(MESSAGE_ACTIONS);
      
      for (const action of actions) {
        // Should contain underscores or be a single word
        expect(action).toMatch(/^[a-z]+(_[a-z]+)*$/);
        // Should NOT contain uppercase letters
        expect(action).not.toMatch(/[A-Z]/);
        // Should NOT be camelCase
        expect(action).not.toMatch(/[a-z][A-Z]/);
      }
    });

    it('should have correct project actions', () => {
      expect(MESSAGE_ACTIONS.GET_ALL_PROJECTS).toBe('get_all_projects');
      expect(MESSAGE_ACTIONS.GET_PROJECT).toBe('get_project');
      expect(MESSAGE_ACTIONS.ADD_PROJECT).toBe('add_project');
      expect(MESSAGE_ACTIONS.UPDATE_PROJECT).toBe('update_project');
      expect(MESSAGE_ACTIONS.DELETE_PROJECT).toBe('delete_project');
    });

    it('should have correct step actions', () => {
      expect(MESSAGE_ACTIONS.UPDATE_PROJECT_STEPS).toBe('update_project_steps');
      expect(MESSAGE_ACTIONS.GET_PROJECT_STEPS).toBe('get_project_steps');
      expect(MESSAGE_ACTIONS.ADD_STEP).toBe('add_step');
      expect(MESSAGE_ACTIONS.DELETE_STEP).toBe('delete_step');
    });

    it('should have correct recording actions', () => {
      expect(MESSAGE_ACTIONS.START_RECORDING).toBe('start_recording');
      expect(MESSAGE_ACTIONS.STOP_RECORDING).toBe('stop_recording');
      expect(MESSAGE_ACTIONS.GET_RECORDING_STATUS).toBe('get_recording_status');
      expect(MESSAGE_ACTIONS.RECORD_STEP).toBe('record_step');
    });

    it('should have correct replay actions', () => {
      expect(MESSAGE_ACTIONS.START_REPLAY).toBe('start_replay');
      expect(MESSAGE_ACTIONS.STOP_REPLAY).toBe('stop_replay');
      expect(MESSAGE_ACTIONS.REPLAY_STEP).toBe('replay_step');
      expect(MESSAGE_ACTIONS.GET_REPLAY_STATUS).toBe('get_replay_status');
    });

    it('should NOT have camelCase actions (wrong format)', () => {
      const wrongFormats = [
        'getAllProjects',
        'getProject',
        'addProject',
        'updateProjectSteps',
        'startRecording'
      ];
      
      const actions = Object.values(MESSAGE_ACTIONS);
      for (const wrongFormat of wrongFormats) {
        expect(actions).not.toContain(wrongFormat);
      }
    });
  });

  describe('ALL_MESSAGE_ACTIONS', () => {
    it('should contain all actions from MESSAGE_ACTIONS', () => {
      const actionValues = Object.values(MESSAGE_ACTIONS);
      
      expect(ALL_MESSAGE_ACTIONS.length).toBe(actionValues.length);
      
      for (const action of actionValues) {
        expect(ALL_MESSAGE_ACTIONS).toContain(action);
      }
    });
  });

  // ==========================================================================
  // TYPE GUARDS
  // ==========================================================================

  describe('isMessageAction', () => {
    it('should return true for valid actions', () => {
      expect(isMessageAction('get_all_projects')).toBe(true);
      expect(isMessageAction('add_project')).toBe(true);
      expect(isMessageAction('start_recording')).toBe(true);
      expect(isMessageAction('replay_step')).toBe(true);
    });

    it('should return false for invalid actions', () => {
      expect(isMessageAction('getAllProjects')).toBe(false); // camelCase
      expect(isMessageAction('invalid_action')).toBe(false);
      expect(isMessageAction('')).toBe(false);
      expect(isMessageAction(null)).toBe(false);
      expect(isMessageAction(undefined)).toBe(false);
      expect(isMessageAction(123)).toBe(false);
    });
  });

  describe('isMessage', () => {
    it('should return true for valid message', () => {
      const message: GetAllProjectsMessage = {
        action: 'get_all_projects',
        payload: undefined
      };
      expect(isMessage(message)).toBe(true);
    });

    it('should return true for message with payload', () => {
      const message = {
        action: 'add_project',
        payload: { name: 'Test', target_url: 'https://example.com' }
      };
      expect(isMessage(message)).toBe(true);
    });

    it('should return false for null/undefined', () => {
      expect(isMessage(null)).toBe(false);
      expect(isMessage(undefined)).toBe(false);
    });

    it('should return false for missing action', () => {
      expect(isMessage({ payload: {} })).toBe(false);
    });

    it('should return false for invalid action', () => {
      expect(isMessage({ action: 'invalidAction', payload: {} })).toBe(false);
    });
  });

  describe('isSuccessResponse', () => {
    it('should return true for success response', () => {
      const response: BaseResponse<string> = {
        success: true,
        data: 'test data'
      };
      expect(isSuccessResponse(response)).toBe(true);
    });

    it('should return false for error response', () => {
      const response: BaseResponse<string> = {
        success: false,
        error: 'Something went wrong'
      };
      expect(isSuccessResponse(response)).toBe(false);
    });
  });

  describe('isErrorResponse', () => {
    it('should return true for error response', () => {
      const response: BaseResponse<unknown> = {
        success: false,
        error: 'Something went wrong'
      };
      expect(isErrorResponse(response)).toBe(true);
    });

    it('should return false for success response', () => {
      const response: BaseResponse<unknown> = {
        success: true,
        data: {}
      };
      expect(isErrorResponse(response)).toBe(false);
    });
  });

  // ==========================================================================
  // FACTORY FUNCTIONS
  // ==========================================================================

  describe('generateRequestId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();
      expect(id1).not.toBe(id2);
    });

    it('should start with req-', () => {
      const id = generateRequestId();
      expect(id).toMatch(/^req-/);
    });
  });

  describe('createMessage', () => {
    it('should create message with action and payload', () => {
      const payload: AddProjectPayload = {
        name: 'Test Project',
        target_url: 'https://example.com'
      };
      
      const message = createMessage('add_project', payload);

      expect(message.action).toBe('add_project');
      expect(message.payload).toBe(payload);
      expect(message.requestId).toBeDefined();
      expect(message.timestamp).toBeDefined();
    });

    it('should use provided requestId', () => {
      const message = createMessage('get_all_projects', undefined, 'custom-id');
      expect(message.requestId).toBe('custom-id');
    });

    it('should generate requestId if not provided', () => {
      const message = createMessage('get_all_projects', undefined);
      expect(message.requestId).toMatch(/^req-/);
    });
  });

  describe('createSuccessResponse', () => {
    it('should create success response with data', () => {
      const data = { id: 1, name: 'Test' };
      const response = createSuccessResponse(data);

      expect(response.success).toBe(true);
      expect(response.data).toBe(data);
      expect(response.error).toBeUndefined();
    });

    it('should include requestId if provided', () => {
      const response = createSuccessResponse('data', 'req-123');
      expect(response.requestId).toBe('req-123');
    });
  });

  describe('createErrorResponse', () => {
    it('should create error response with message', () => {
      const response = createErrorResponse('Something went wrong');

      expect(response.success).toBe(false);
      expect(response.error).toBe('Something went wrong');
      expect(response.data).toBeUndefined();
    });

    it('should include requestId if provided', () => {
      const response = createErrorResponse('Error', 'req-123');
      expect(response.requestId).toBe('req-123');
    });
  });

  // ==========================================================================
  // CATEGORY HELPERS
  // ==========================================================================

  describe('Action categories', () => {
    it('PROJECT_ACTIONS should contain project-related actions', () => {
      expect(PROJECT_ACTIONS).toContain('get_all_projects');
      expect(PROJECT_ACTIONS).toContain('get_project');
      expect(PROJECT_ACTIONS).toContain('add_project');
      expect(PROJECT_ACTIONS).toContain('update_project');
      expect(PROJECT_ACTIONS).toContain('delete_project');
    });

    it('STEP_ACTIONS should contain step-related actions', () => {
      expect(STEP_ACTIONS).toContain('update_project_steps');
      expect(STEP_ACTIONS).toContain('get_project_steps');
      expect(STEP_ACTIONS).toContain('add_step');
      expect(STEP_ACTIONS).toContain('delete_step');
    });

    it('RECORDING_ACTIONS should contain recording-related actions', () => {
      expect(RECORDING_ACTIONS).toContain('start_recording');
      expect(RECORDING_ACTIONS).toContain('stop_recording');
      expect(RECORDING_ACTIONS).toContain('get_recording_status');
      expect(RECORDING_ACTIONS).toContain('record_step');
    });

    it('REPLAY_ACTIONS should contain replay-related actions', () => {
      expect(REPLAY_ACTIONS).toContain('start_replay');
      expect(REPLAY_ACTIONS).toContain('stop_replay');
      expect(REPLAY_ACTIONS).toContain('replay_step');
      expect(REPLAY_ACTIONS).toContain('get_replay_status');
    });
  });

  describe('isProjectAction', () => {
    it('should return true for project actions', () => {
      expect(isProjectAction('get_all_projects')).toBe(true);
      expect(isProjectAction('add_project')).toBe(true);
      expect(isProjectAction('delete_project')).toBe(true);
    });

    it('should return false for non-project actions', () => {
      expect(isProjectAction('start_recording')).toBe(false);
      expect(isProjectAction('replay_step')).toBe(false);
    });
  });

  describe('isStepAction', () => {
    it('should return true for step actions', () => {
      expect(isStepAction('update_project_steps')).toBe(true);
      expect(isStepAction('add_step')).toBe(true);
      expect(isStepAction('delete_step')).toBe(true);
    });

    it('should return false for non-step actions', () => {
      expect(isStepAction('add_project')).toBe(false);
      expect(isStepAction('start_recording')).toBe(false);
    });
  });

  describe('isRecordingAction', () => {
    it('should return true for recording actions', () => {
      expect(isRecordingAction('start_recording')).toBe(true);
      expect(isRecordingAction('stop_recording')).toBe(true);
      expect(isRecordingAction('record_step')).toBe(true);
    });

    it('should return false for non-recording actions', () => {
      expect(isRecordingAction('add_project')).toBe(false);
      expect(isRecordingAction('start_replay')).toBe(false);
    });
  });

  describe('isReplayAction', () => {
    it('should return true for replay actions', () => {
      expect(isReplayAction('start_replay')).toBe(true);
      expect(isReplayAction('stop_replay')).toBe(true);
      expect(isReplayAction('replay_step')).toBe(true);
    });

    it('should return false for non-replay actions', () => {
      expect(isReplayAction('add_project')).toBe(false);
      expect(isReplayAction('start_recording')).toBe(false);
    });
  });

  // ==========================================================================
  // TYPE INFERENCE TESTS
  // ==========================================================================

  describe('Type inference', () => {
    it('should correctly type message payloads', () => {
      // This is a compile-time check - if it compiles, the types are correct
      const addProjectMessage = createMessage('add_project', {
        name: 'Test',
        target_url: 'https://example.com'
      });
      
      expect(addProjectMessage.action).toBe('add_project');
      expect(addProjectMessage.payload.name).toBe('Test');
      expect(addProjectMessage.payload.target_url).toBe('https://example.com');
    });

    it('should handle optional payload properties', () => {
      const addProjectMessage = createMessage('add_project', {
        name: 'Test',
        description: 'Optional description',
        target_url: 'https://example.com'
      });
      
      expect(addProjectMessage.payload.description).toBe('Optional description');
    });
  });
});
