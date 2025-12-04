/**
 * Tests for ReplayHandlers
 * @module background/handlers/ReplayHandlers.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ReplayHandlers,
  createReplayHandlers,
  registerReplayHandlers,
  REPLAY_ACTIONS,
  type IReplayStateStorage,
  type ITabCommunication,
  type IResultStorage,
  type ReplaySession,
  type ReplayStep,
  type StepResult,
  type ReplayEvent,
} from './ReplayHandlers';
import { MessageReceiver } from '../MessageReceiver';
import { BackgroundConfig } from '../BackgroundConfig';

// ============================================================================
// MOCK FACTORIES
// ============================================================================

function createMockStateStorage(): IReplayStateStorage {
  let storedState: ReplaySession | null = null;

  return {
    saveReplayState: vi.fn(async (state) => {
      storedState = state;
    }),
    loadReplayState: vi.fn(async () => storedState),
  };
}

function createMockTabCommunication(): ITabCommunication {
  return {
    sendToTab: vi.fn(async () => true),
  };
}

function createMockResultStorage(): IResultStorage & {
  _results: Map<number, StepResult[]>;
} {
  const results = new Map<number, StepResult[]>();

  return {
    _results: results,
    addResult: vi.fn(async (testRunId, result) => {
      const existing = results.get(testRunId) ?? [];
      existing.push(result);
      results.set(testRunId, existing);
    }),
    getResults: vi.fn(async (testRunId) => results.get(testRunId) ?? []),
    clearResults: vi.fn(async (testRunId) => {
      results.delete(testRunId);
    }),
  };
}

function createMockSender(tabId?: number): { tab?: { id: number } } {
  return tabId ? { tab: { id: tabId } } : {};
}

function createMockStep(index: number = 0, overrides: Partial<ReplayStep> = {}): ReplayStep {
  return {
    index,
    eventType: 'click',
    xpath: '/html/body/button',
    label: 'Submit',
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

describe('ReplayHandlers', () => {
  let handlers: ReplayHandlers;
  let stateStorage: ReturnType<typeof createMockStateStorage>;
  let tabComm: ReturnType<typeof createMockTabCommunication>;
  let resultStorage: ReturnType<typeof createMockResultStorage>;

  beforeEach(() => {
    stateStorage = createMockStateStorage();
    tabComm = createMockTabCommunication();
    resultStorage = createMockResultStorage();
    handlers = new ReplayHandlers(stateStorage, tabComm, resultStorage);
    vi.clearAllMocks();
  });

  // ==========================================================================
  // START REPLAY TESTS
  // ==========================================================================

  describe('handleStartReplay', () => {
    it('should start replay with valid payload', async () => {
      const response = await handlers.handleStartReplay(
        {
          action: 'start_replay',
          payload: {
            projectId: 1,
            tabId: 123,
            steps: [createMockStep(0), createMockStep(1)],
          },
        },
        createMockSender()
      );

      expect(response.success).toBe(true);
      expect(response.data?.session).toBeDefined();
      expect(response.data?.session.status).toBe('running');
      expect(response.data?.session.totalSteps).toBe(2);
    });

    it('should require projectId', async () => {
      const response = await handlers.handleStartReplay(
        {
          action: 'start_replay',
          payload: { tabId: 123, steps: [createMockStep()] },
        },
        createMockSender()
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('projectId');
    });

    it('should require steps', async () => {
      const response = await handlers.handleStartReplay(
        {
          action: 'start_replay',
          payload: { projectId: 1, tabId: 123, steps: [] },
        },
        createMockSender()
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('steps');
    });

    it('should prevent double replay', async () => {
      await handlers.handleStartReplay(
        {
          action: 'start_replay',
          payload: { projectId: 1, tabId: 123, steps: [createMockStep()] },
        },
        createMockSender()
      );

      const response = await handlers.handleStartReplay(
        {
          action: 'start_replay',
          payload: { projectId: 2, tabId: 456, steps: [createMockStep()] },
        },
        createMockSender()
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('Already replaying');
    });

    it('should handle CSV rows', async () => {
      const response = await handlers.handleStartReplay(
        {
          action: 'start_replay',
          payload: {
            projectId: 1,
            tabId: 123,
            steps: [createMockStep()],
            csvRows: [{ name: 'John' }, { name: 'Jane' }],
          },
        },
        createMockSender()
      );

      expect(response.data?.session.totalRows).toBe(2);
    });
  });

  // ==========================================================================
  // STOP REPLAY TESTS
  // ==========================================================================

  describe('handleStopReplay', () => {
    beforeEach(async () => {
      await handlers.handleStartReplay(
        {
          action: 'start_replay',
          payload: {
            projectId: 1,
            tabId: 123,
            testRunId: 100,
            steps: [createMockStep(0), createMockStep(1)],
          },
        },
        createMockSender()
      );
    });

    it('should stop replay', async () => {
      const response = await handlers.handleStopReplay(
        { action: 'stop_replay', payload: {} },
        createMockSender()
      );

      expect(response.success).toBe(true);
      expect(response.data?.session.status).toBe('completed');
      expect(handlers.isRunning()).toBe(false);
    });

    it('should return results summary', async () => {
      // Execute a step first
      await handlers.handleExecuteStep(
        {
          action: 'execute_step',
          payload: { step: createMockStep(0) },
        },
        createMockSender()
      );

      const response = await handlers.handleStopReplay(
        { action: 'stop_replay', payload: {} },
        createMockSender()
      );

      expect(response.data?.summary).toBeDefined();
      expect(response.data?.results).toBeDefined();
    });

    it('should fail if not replaying', async () => {
      await handlers.handleStopReplay(
        { action: 'stop_replay', payload: {} },
        createMockSender()
      );

      const response = await handlers.handleStopReplay(
        { action: 'stop_replay', payload: {} },
        createMockSender()
      );

      expect(response.success).toBe(false);
    });
  });

  // ==========================================================================
  // PAUSE/RESUME TESTS
  // ==========================================================================

  describe('handlePauseReplay', () => {
    beforeEach(async () => {
      await handlers.handleStartReplay(
        {
          action: 'start_replay',
          payload: { projectId: 1, tabId: 123, steps: [createMockStep()] },
        },
        createMockSender()
      );
    });

    it('should pause replay', async () => {
      const response = await handlers.handlePauseReplay(
        { action: 'pause_replay', payload: {} },
        createMockSender()
      );

      expect(response.success).toBe(true);
      expect(handlers.isPaused()).toBe(true);
    });
  });

  describe('handleResumeReplay', () => {
    beforeEach(async () => {
      await handlers.handleStartReplay(
        {
          action: 'start_replay',
          payload: { projectId: 1, tabId: 123, steps: [createMockStep()] },
        },
        createMockSender()
      );
      await handlers.handlePauseReplay(
        { action: 'pause_replay', payload: {} },
        createMockSender()
      );
    });

    it('should resume replay', async () => {
      const response = await handlers.handleResumeReplay(
        { action: 'resume_replay', payload: {} },
        createMockSender()
      );

      expect(response.success).toBe(true);
      expect(handlers.isRunning()).toBe(true);
    });
  });

  // ==========================================================================
  // EXECUTE STEP TESTS
  // ==========================================================================

  describe('handleExecuteStep', () => {
    beforeEach(async () => {
      await handlers.handleStartReplay(
        {
          action: 'start_replay',
          payload: { projectId: 1, tabId: 123, steps: [createMockStep(0), createMockStep(1)] },
        },
        createMockSender()
      );
    });

    it('should execute step successfully', async () => {
      const response = await handlers.handleExecuteStep(
        {
          action: 'execute_step',
          payload: { step: createMockStep(0) },
        },
        createMockSender()
      );

      expect(response.success).toBe(true);
      expect(response.data?.result.status).toBe('passed');
    });

    it('should handle step failure', async () => {
      vi.mocked(tabComm.sendToTab).mockResolvedValue(false);

      const response = await handlers.handleExecuteStep(
        {
          action: 'execute_step',
          payload: { step: createMockStep(0) },
        },
        createMockSender()
      );

      expect(response.data?.result.status).toBe('failed');
    });

    it('should substitute CSV values', async () => {
      const step = createMockStep(0, { value: '{{name}}' });

      await handlers.handleExecuteStep(
        {
          action: 'execute_step',
          payload: {
            step,
            csvValues: { name: 'John Doe' },
          },
        },
        createMockSender()
      );

      expect(tabComm.sendToTab).toHaveBeenCalledWith(
        123,
        expect.objectContaining({
          data: expect.objectContaining({
            value: 'John Doe',
          }),
        })
      );
    });

    it('should track statistics', async () => {
      await handlers.handleExecuteStep(
        {
          action: 'execute_step',
          payload: { step: createMockStep(0) },
        },
        createMockSender()
      );

      const stats = handlers.getStats();
      expect(stats.stepsExecuted).toBe(1);
      expect(stats.stepsPassed).toBe(1);
    });
  });

  // ==========================================================================
  // EXECUTE NEXT STEP TESTS
  // ==========================================================================

  describe('handleExecuteNextStep', () => {
    beforeEach(async () => {
      await handlers.handleStartReplay(
        {
          action: 'start_replay',
          payload: {
            projectId: 1,
            tabId: 123,
            steps: [createMockStep(0), createMockStep(1)],
            csvRows: [{ row: '1' }],
          },
        },
        createMockSender()
      );
    });

    it('should execute next step in sequence', async () => {
      const response1 = await handlers.handleExecuteNextStep(
        { action: 'execute_next_step', payload: {} },
        createMockSender()
      );

      expect(response1.success).toBe(true);

      const response2 = await handlers.handleExecuteNextStep(
        { action: 'execute_next_step', payload: {} },
        createMockSender()
      );

      expect(response2.success).toBe(true);
    });

    it('should complete replay when all steps done', async () => {
      await handlers.handleExecuteNextStep(
        { action: 'execute_next_step', payload: {} },
        createMockSender()
      );
      await handlers.handleExecuteNextStep(
        { action: 'execute_next_step', payload: {} },
        createMockSender()
      );

      const response = await handlers.handleExecuteNextStep(
        { action: 'execute_next_step', payload: {} },
        createMockSender()
      );

      expect(response.data?.complete).toBe(true);
    });
  });

  // ==========================================================================
  // SKIP STEP TESTS
  // ==========================================================================

  describe('handleSkipStep', () => {
    beforeEach(async () => {
      await handlers.handleStartReplay(
        {
          action: 'start_replay',
          payload: { projectId: 1, tabId: 123, steps: [createMockStep(0), createMockStep(1)] },
        },
        createMockSender()
      );
    });

    it('should skip step', async () => {
      const response = await handlers.handleSkipStep(
        { action: 'skip_step', payload: {} },
        createMockSender()
      );

      expect(response.success).toBe(true);
      expect(response.data?.result.status).toBe('skipped');
    });

    it('should update statistics', async () => {
      await handlers.handleSkipStep(
        { action: 'skip_step', payload: {} },
        createMockSender()
      );

      const stats = handlers.getStats();
      expect(stats.stepsSkipped).toBe(1);
    });
  });

  // ==========================================================================
  // STATUS TESTS
  // ==========================================================================

  describe('handleGetReplayStatus', () => {
    it('should return idle status when not replaying', async () => {
      const response = await handlers.handleGetReplayStatus(
        { action: 'get_replay_status', payload: {} },
        createMockSender()
      );

      expect(response.success).toBe(true);
      expect(response.data?.isRunning).toBe(false);
    });

    it('should return running status', async () => {
      await handlers.handleStartReplay(
        {
          action: 'start_replay',
          payload: { projectId: 1, tabId: 123, steps: [createMockStep()] },
        },
        createMockSender()
      );

      const response = await handlers.handleGetReplayStatus(
        { action: 'get_replay_status', payload: {} },
        createMockSender()
      );

      expect(response.data?.isRunning).toBe(true);
      expect(response.data?.progress).toBeDefined();
    });
  });

  // ==========================================================================
  // RESULTS TESTS
  // ==========================================================================

  describe('handleGetReplayResults', () => {
    beforeEach(async () => {
      await handlers.handleStartReplay(
        {
          action: 'start_replay',
          payload: { projectId: 1, tabId: 123, testRunId: 100, steps: [createMockStep(0)] },
        },
        createMockSender()
      );
    });

    it('should get results', async () => {
      await handlers.handleExecuteStep(
        {
          action: 'execute_step',
          payload: { step: createMockStep(0) },
        },
        createMockSender()
      );

      const response = await handlers.handleGetReplayResults(
        { action: 'get_replay_results', payload: { testRunId: 100 } },
        createMockSender()
      );

      expect(response.success).toBe(true);
      expect(response.data?.results).toHaveLength(1);
      expect(response.data?.summary.total).toBe(1);
    });
  });

  // ==========================================================================
  // EVENT TESTS
  // ==========================================================================

  describe('events', () => {
    it('should emit replay_started event', async () => {
      const events: ReplayEvent[] = [];
      handlers.onEvent(e => events.push(e));

      await handlers.handleStartReplay(
        {
          action: 'start_replay',
          payload: { projectId: 1, tabId: 123, steps: [createMockStep()] },
        },
        createMockSender()
      );

      expect(events.some(e => e.type === 'replay_started')).toBe(true);
    });

    it('should emit step events', async () => {
      await handlers.handleStartReplay(
        {
          action: 'start_replay',
          payload: { projectId: 1, tabId: 123, steps: [createMockStep()] },
        },
        createMockSender()
      );

      const events: ReplayEvent[] = [];
      handlers.onEvent(e => events.push(e));

      await handlers.handleExecuteStep(
        {
          action: 'execute_step',
          payload: { step: createMockStep(0) },
        },
        createMockSender()
      );

      expect(events.some(e => e.type === 'step_started')).toBe(true);
      expect(events.some(e => e.type === 'step_completed')).toBe(true);
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

      expect(receiver.hasHandler(REPLAY_ACTIONS.START_REPLAY)).toBe(true);
      expect(receiver.hasHandler(REPLAY_ACTIONS.STOP_REPLAY)).toBe(true);
      expect(receiver.hasHandler(REPLAY_ACTIONS.EXECUTE_STEP)).toBe(true);
    });

    it('should get handler entries', () => {
      const entries = handlers.getHandlerEntries();

      expect(entries).toHaveLength(10);
      expect(entries.every(e => e.category === 'replay')).toBe(true);
    });
  });
});

// ============================================================================
// FACTORY FUNCTION TESTS
// ============================================================================

describe('createReplayHandlers', () => {
  it('should create instance', () => {
    const handlers = createReplayHandlers(
      createMockStateStorage(),
      createMockTabCommunication(),
      createMockResultStorage()
    );

    expect(handlers).toBeInstanceOf(ReplayHandlers);
  });
});

describe('registerReplayHandlers', () => {
  it('should create and register handlers', () => {
    const config = new BackgroundConfig();
    const receiver = new MessageReceiver(config);

    const handlers = registerReplayHandlers(
      receiver,
      createMockStateStorage(),
      createMockTabCommunication(),
      createMockResultStorage()
    );

    expect(handlers).toBeInstanceOf(ReplayHandlers);
    expect(receiver.hasHandler(REPLAY_ACTIONS.START_REPLAY)).toBe(true);
  });
});
