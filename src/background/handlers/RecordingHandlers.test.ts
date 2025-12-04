/**
 * Tests for RecordingHandlers
 * @module background/handlers/RecordingHandlers.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  RecordingHandlers,
  createRecordingHandlers,
  registerRecordingHandlers,
  RECORDING_ACTIONS,
  type IRecordingStateStorage,
  type ITabCommunication,
  type IStepStorage,
  type RecordingSession,
  type RecordedStep,
  type RecordingEvent,
} from './RecordingHandlers';
import { MessageReceiver } from '../MessageReceiver';
import { BackgroundConfig } from '../BackgroundConfig';

// ============================================================================
// MOCK FACTORIES
// ============================================================================

function createMockStateStorage(): IRecordingStateStorage {
  let storedState: RecordingSession | null = null;

  return {
    saveRecordingState: vi.fn(async (state) => {
      storedState = state;
    }),
    loadRecordingState: vi.fn(async () => storedState),
  };
}

function createMockTabCommunication(): ITabCommunication {
  return {
    sendToTab: vi.fn(async () => ({ success: true })),
  };
}

function createMockStepStorage(): IStepStorage & {
  _steps: Map<number, RecordedStep[]>;
} {
  const steps = new Map<number, RecordedStep[]>();

  return {
    _steps: steps,
    addStep: vi.fn(async (projectId, step) => {
      const existing = steps.get(projectId) ?? [];
      existing.push(step);
      steps.set(projectId, existing);
    }),
    getSteps: vi.fn(async (projectId) => steps.get(projectId) ?? []),
    clearSteps: vi.fn(async (projectId) => {
      steps.delete(projectId);
    }),
  };
}

function createMockSender(tabId?: number): { tab?: { id: number } } {
  return tabId ? { tab: { id: tabId } } : {};
}

function createMockStep(overrides: Partial<RecordedStep> = {}): RecordedStep {
  return {
    eventType: 'click',
    xpath: '/html/body/button',
    label: 'Submit',
    timestamp: Date.now(),
    bundle: {
      tag: 'BUTTON',
      xpath: '/html/body/button',
      visibleText: 'Submit',
    },
    ...overrides,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('RecordingHandlers', () => {
  let handlers: RecordingHandlers;
  let stateStorage: ReturnType<typeof createMockStateStorage>;
  let tabComm: ReturnType<typeof createMockTabCommunication>;
  let stepStorage: ReturnType<typeof createMockStepStorage>;

  beforeEach(() => {
    stateStorage = createMockStateStorage();
    tabComm = createMockTabCommunication();
    stepStorage = createMockStepStorage();
    handlers = new RecordingHandlers(stateStorage, tabComm, stepStorage);
    vi.clearAllMocks();
  });

  // ==========================================================================
  // START RECORDING TESTS
  // ==========================================================================

  describe('handleStartRecording', () => {
    it('should start recording with valid payload', async () => {
      const response = await handlers.handleStartRecording(
        { action: 'start_recording', payload: { projectId: 1, tabId: 123 } },
        createMockSender()
      );

      expect(response.success).toBe(true);
      expect(response.data?.session).toBeDefined();
      expect(response.data?.session.projectId).toBe(1);
      expect(response.data?.session.tabId).toBe(123);
      expect(response.data?.session.status).toBe('recording');
    });

    it('should require projectId', async () => {
      const response = await handlers.handleStartRecording(
        { action: 'start_recording', payload: { tabId: 123 } },
        createMockSender()
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('projectId');
    });

    it('should require tabId', async () => {
      const response = await handlers.handleStartRecording(
        { action: 'start_recording', payload: { projectId: 1 } },
        createMockSender()
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('tabId');
    });

    it('should prevent double recording', async () => {
      await handlers.handleStartRecording(
        { action: 'start_recording', payload: { projectId: 1, tabId: 123 } },
        createMockSender()
      );

      const response = await handlers.handleStartRecording(
        { action: 'start_recording', payload: { projectId: 2, tabId: 456 } },
        createMockSender()
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('Already recording');
    });

    it('should save state to storage', async () => {
      await handlers.handleStartRecording(
        { action: 'start_recording', payload: { projectId: 1, tabId: 123 } },
        createMockSender()
      );

      expect(stateStorage.saveRecordingState).toHaveBeenCalled();
    });

    it('should notify tab', async () => {
      await handlers.handleStartRecording(
        { action: 'start_recording', payload: { projectId: 1, tabId: 123 } },
        createMockSender()
      );

      expect(tabComm.sendToTab).toHaveBeenCalledWith(123, expect.objectContaining({
        action: 'enable_recording',
      }));
    });

    it('should track statistics', async () => {
      await handlers.handleStartRecording(
        { action: 'start_recording', payload: { projectId: 1, tabId: 123 } },
        createMockSender()
      );

      expect(handlers.getStats().sessionsStarted).toBe(1);
    });
  });

  // ==========================================================================
  // STOP RECORDING TESTS
  // ==========================================================================

  describe('handleStopRecording', () => {
    beforeEach(async () => {
      await handlers.handleStartRecording(
        { action: 'start_recording', payload: { projectId: 1, tabId: 123 } },
        createMockSender()
      );
    });

    it('should stop recording', async () => {
      const response = await handlers.handleStopRecording(
        { action: 'stop_recording', payload: {} },
        createMockSender()
      );

      expect(response.success).toBe(true);
      expect(response.data?.projectId).toBe(1);
      expect(handlers.isRecording()).toBe(false);
    });

    it('should return captured steps', async () => {
      // Record some steps
      await handlers.handleRecordStep(
        { action: 'record_step', payload: { step: createMockStep() } },
        createMockSender(123)
      );
      await handlers.handleRecordStep(
        { action: 'record_step', payload: { step: createMockStep() } },
        createMockSender(123)
      );

      const response = await handlers.handleStopRecording(
        { action: 'stop_recording', payload: {} },
        createMockSender()
      );

      expect(response.data?.stepCount).toBe(2);
      expect(response.data?.steps).toHaveLength(2);
    });

    it('should fail if not recording', async () => {
      await handlers.handleStopRecording(
        { action: 'stop_recording', payload: {} },
        createMockSender()
      );

      const response = await handlers.handleStopRecording(
        { action: 'stop_recording', payload: {} },
        createMockSender()
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('No active recording');
    });

    it('should notify tab', async () => {
      await handlers.handleStopRecording(
        { action: 'stop_recording', payload: {} },
        createMockSender()
      );

      expect(tabComm.sendToTab).toHaveBeenCalledWith(123, expect.objectContaining({
        action: 'disable_recording',
      }));
    });

    it('should save steps to storage', async () => {
      await handlers.handleRecordStep(
        { action: 'record_step', payload: { step: createMockStep() } },
        createMockSender(123)
      );

      await handlers.handleStopRecording(
        { action: 'stop_recording', payload: {} },
        createMockSender()
      );

      expect(stepStorage.addStep).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // PAUSE/RESUME TESTS
  // ==========================================================================

  describe('handlePauseRecording', () => {
    beforeEach(async () => {
      await handlers.handleStartRecording(
        { action: 'start_recording', payload: { projectId: 1, tabId: 123 } },
        createMockSender()
      );
    });

    it('should pause recording', async () => {
      const response = await handlers.handlePauseRecording(
        { action: 'pause_recording', payload: {} },
        createMockSender()
      );

      expect(response.success).toBe(true);
      expect(handlers.isPaused()).toBe(true);
    });

    it('should fail if not recording', async () => {
      await handlers.handleStopRecording(
        { action: 'stop_recording', payload: {} },
        createMockSender()
      );

      const response = await handlers.handlePauseRecording(
        { action: 'pause_recording', payload: {} },
        createMockSender()
      );

      expect(response.success).toBe(false);
    });
  });

  describe('handleResumeRecording', () => {
    beforeEach(async () => {
      await handlers.handleStartRecording(
        { action: 'start_recording', payload: { projectId: 1, tabId: 123 } },
        createMockSender()
      );
      await handlers.handlePauseRecording(
        { action: 'pause_recording', payload: {} },
        createMockSender()
      );
    });

    it('should resume recording', async () => {
      const response = await handlers.handleResumeRecording(
        { action: 'resume_recording', payload: {} },
        createMockSender()
      );

      expect(response.success).toBe(true);
      expect(handlers.isRecording()).toBe(true);
    });

    it('should track paused time', async () => {
      // Wait a bit to simulate pause duration
      await new Promise(resolve => setTimeout(resolve, 10));

      await handlers.handleResumeRecording(
        { action: 'resume_recording', payload: {} },
        createMockSender()
      );

      const session = handlers.getCurrentSession();
      expect(session?.totalPausedTime).toBeGreaterThan(0);
    });

    it('should fail if not paused', async () => {
      await handlers.handleResumeRecording(
        { action: 'resume_recording', payload: {} },
        createMockSender()
      );

      const response = await handlers.handleResumeRecording(
        { action: 'resume_recording', payload: {} },
        createMockSender()
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('Cannot resume');
    });
  });

  // ==========================================================================
  // RECORD STEP TESTS
  // ==========================================================================

  describe('handleRecordStep', () => {
    beforeEach(async () => {
      await handlers.handleStartRecording(
        { action: 'start_recording', payload: { projectId: 1, tabId: 123 } },
        createMockSender()
      );
    });

    it('should record step', async () => {
      const step = createMockStep();
      const response = await handlers.handleRecordStep(
        { action: 'record_step', payload: { step } },
        createMockSender(123)
      );

      expect(response.success).toBe(true);
      expect(response.data?.stepIndex).toBe(0);
      expect(response.data?.totalSteps).toBe(1);
    });

    it('should require step', async () => {
      const response = await handlers.handleRecordStep(
        { action: 'record_step', payload: {} },
        createMockSender(123)
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('step is required');
    });

    it('should fail if not recording', async () => {
      await handlers.handleStopRecording(
        { action: 'stop_recording', payload: {} },
        createMockSender()
      );

      const response = await handlers.handleRecordStep(
        { action: 'record_step', payload: { step: createMockStep() } },
        createMockSender(123)
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('Not currently recording');
    });

    it('should increment step count', async () => {
      await handlers.handleRecordStep(
        { action: 'record_step', payload: { step: createMockStep() } },
        createMockSender(123)
      );
      await handlers.handleRecordStep(
        { action: 'record_step', payload: { step: createMockStep() } },
        createMockSender(123)
      );

      const session = handlers.getCurrentSession();
      expect(session?.stepCount).toBe(2);
    });

    it('should track statistics', async () => {
      await handlers.handleRecordStep(
        { action: 'record_step', payload: { step: createMockStep() } },
        createMockSender(123)
      );

      expect(handlers.getStats().stepsCaptured).toBe(1);
    });
  });

  // ==========================================================================
  // GET/CLEAR STEPS TESTS
  // ==========================================================================

  describe('handleGetRecordedSteps', () => {
    beforeEach(async () => {
      await handlers.handleStartRecording(
        { action: 'start_recording', payload: { projectId: 1, tabId: 123 } },
        createMockSender()
      );
    });

    it('should get recorded steps', async () => {
      await handlers.handleRecordStep(
        { action: 'record_step', payload: { step: createMockStep() } },
        createMockSender(123)
      );

      const response = await handlers.handleGetRecordedSteps(
        { action: 'get_recorded_steps', payload: { projectId: 1 } },
        createMockSender()
      );

      expect(response.success).toBe(true);
      expect(response.data?.steps).toHaveLength(1);
    });

    it('should use current session project if not specified', async () => {
      await handlers.handleRecordStep(
        { action: 'record_step', payload: { step: createMockStep() } },
        createMockSender(123)
      );

      const response = await handlers.handleGetRecordedSteps(
        { action: 'get_recorded_steps', payload: {} },
        createMockSender()
      );

      expect(response.success).toBe(true);
      expect(response.data?.projectId).toBe(1);
    });
  });

  describe('handleClearRecordedSteps', () => {
    beforeEach(async () => {
      await handlers.handleStartRecording(
        { action: 'start_recording', payload: { projectId: 1, tabId: 123 } },
        createMockSender()
      );
      await handlers.handleRecordStep(
        { action: 'record_step', payload: { step: createMockStep() } },
        createMockSender(123)
      );
    });

    it('should clear steps', async () => {
      const response = await handlers.handleClearRecordedSteps(
        { action: 'clear_recorded_steps', payload: { projectId: 1 } },
        createMockSender()
      );

      expect(response.success).toBe(true);

      const stepsResponse = await handlers.handleGetRecordedSteps(
        { action: 'get_recorded_steps', payload: { projectId: 1 } },
        createMockSender()
      );
      expect(stepsResponse.data?.steps).toHaveLength(0);
    });

    it('should reset session step count', async () => {
      await handlers.handleClearRecordedSteps(
        { action: 'clear_recorded_steps', payload: { projectId: 1 } },
        createMockSender()
      );

      const session = handlers.getCurrentSession();
      expect(session?.stepCount).toBe(0);
    });
  });

  // ==========================================================================
  // STATUS TESTS
  // ==========================================================================

  describe('handleGetRecordingStatus', () => {
    it('should return idle status when not recording', async () => {
      const response = await handlers.handleGetRecordingStatus(
        { action: 'get_recording_status', payload: {} },
        createMockSender()
      );

      expect(response.success).toBe(true);
      expect(response.data?.isRecording).toBe(false);
      expect(response.data?.session).toBeNull();
    });

    it('should return recording status', async () => {
      await handlers.handleStartRecording(
        { action: 'start_recording', payload: { projectId: 1, tabId: 123 } },
        createMockSender()
      );

      const response = await handlers.handleGetRecordingStatus(
        { action: 'get_recording_status', payload: {} },
        createMockSender()
      );

      expect(response.data?.isRecording).toBe(true);
      expect(response.data?.session?.projectId).toBe(1);
    });

    it('should restore from storage', async () => {
      // Simulate storage has session
      vi.mocked(stateStorage.loadRecordingState).mockResolvedValue({
        projectId: 5,
        tabId: 999,
        status: 'recording',
        startedAt: new Date(),
        stepCount: 3,
        totalPausedTime: 0,
      });

      const freshHandlers = new RecordingHandlers(stateStorage, tabComm, stepStorage);

      const response = await freshHandlers.handleGetRecordingStatus(
        { action: 'get_recording_status', payload: {} },
        createMockSender()
      );

      expect(response.data?.isRecording).toBe(true);
      expect(response.data?.session?.projectId).toBe(5);
    });
  });

  // ==========================================================================
  // EVENT TESTS
  // ==========================================================================

  describe('events', () => {
    it('should emit recording_started event', async () => {
      const events: RecordingEvent[] = [];
      handlers.onEvent(e => events.push(e));

      await handlers.handleStartRecording(
        { action: 'start_recording', payload: { projectId: 1, tabId: 123 } },
        createMockSender()
      );

      expect(events.some(e => e.type === 'recording_started')).toBe(true);
    });

    it('should emit step_recorded event', async () => {
      await handlers.handleStartRecording(
        { action: 'start_recording', payload: { projectId: 1, tabId: 123 } },
        createMockSender()
      );

      const events: RecordingEvent[] = [];
      handlers.onEvent(e => events.push(e));

      await handlers.handleRecordStep(
        { action: 'record_step', payload: { step: createMockStep() } },
        createMockSender(123)
      );

      expect(events.some(e => e.type === 'step_recorded')).toBe(true);
    });

    it('should unsubscribe from events', async () => {
      const events: RecordingEvent[] = [];
      const unsubscribe = handlers.onEvent(e => events.push(e));

      unsubscribe();

      await handlers.handleStartRecording(
        { action: 'start_recording', payload: { projectId: 1, tabId: 123 } },
        createMockSender()
      );

      expect(events).toHaveLength(0);
    });
  });

  // ==========================================================================
  // REGISTRATION TESTS
  // ==========================================================================

  describe('registration', () => {
    it('should register all handlers', () => {
      const config = new BackgroundConfig();
      const receiver = new MessageReceiver(config);

      handlers.registerAll(receiver);

      // Verify handlers are registered
      expect(receiver.hasHandler(RECORDING_ACTIONS.START_RECORDING)).toBe(true);
      expect(receiver.hasHandler(RECORDING_ACTIONS.STOP_RECORDING)).toBe(true);
      expect(receiver.hasHandler(RECORDING_ACTIONS.PAUSE_RECORDING)).toBe(true);
      expect(receiver.hasHandler(RECORDING_ACTIONS.RESUME_RECORDING)).toBe(true);
      expect(receiver.hasHandler(RECORDING_ACTIONS.RECORD_STEP)).toBe(true);
    });

    it('should get handler entries', () => {
      const entries = handlers.getHandlerEntries();

      expect(entries).toHaveLength(8);
      expect(entries.every(e => e.category === 'recording')).toBe(true);
    });
  });
});

// ============================================================================
// FACTORY FUNCTION TESTS
// ============================================================================

describe('createRecordingHandlers', () => {
  it('should create instance', () => {
    const handlers = createRecordingHandlers(
      createMockStateStorage(),
      createMockTabCommunication(),
      createMockStepStorage()
    );

    expect(handlers).toBeInstanceOf(RecordingHandlers);
  });
});

describe('registerRecordingHandlers', () => {
  it('should create and register handlers', () => {
    const config = new BackgroundConfig();
    const receiver = new MessageReceiver(config);

    const handlers = registerRecordingHandlers(
      receiver,
      createMockStateStorage(),
      createMockTabCommunication(),
      createMockStepStorage()
    );

    expect(handlers).toBeInstanceOf(RecordingHandlers);
    expect(receiver.hasHandler(RECORDING_ACTIONS.START_RECORDING)).toBe(true);
  });
});
