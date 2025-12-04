/**
 * Tests for OrchestratorSession
 * @module core/orchestrator/OrchestratorSession.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  OrchestratorSession,
  createOrchestratorSession,
  DEFAULT_SESSION_CONFIG,
  type SessionMetadata,
  type SessionStatus,
  type Checkpoint,
  type ISessionStorage,
} from './OrchestratorSession';

// ============================================================================
// HELPERS
// ============================================================================

function createTestMetadata(overrides: Partial<SessionMetadata> = {}): SessionMetadata {
  return {
    projectId: 1,
    targetUrl: 'https://example.com',
    totalSteps: 5,
    totalRows: 10,
    hasCsvData: true,
    ...overrides,
  };
}

function createMockStorage(): ISessionStorage {
  return {
    saveSession: vi.fn().mockResolvedValue(undefined),
    loadSession: vi.fn().mockResolvedValue(null),
    saveCheckpoint: vi.fn().mockResolvedValue(undefined),
    loadLatestCheckpoint: vi.fn().mockResolvedValue(null),
    deleteSession: vi.fn().mockResolvedValue(undefined),
    listSessions: vi.fn().mockResolvedValue([]),
  };
}

// ============================================================================
// CONSTRUCTOR TESTS
// ============================================================================

describe('OrchestratorSession', () => {
  let sessionManager: OrchestratorSession;

  beforeEach(() => {
    sessionManager = new OrchestratorSession();
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      const config = sessionManager.getConfig();
      expect(config.autoCheckpoint).toBe(true);
      expect(config.checkpointInterval).toBe(10);
    });

    it('should accept custom config', () => {
      const custom = new OrchestratorSession({ checkpointInterval: 5 });
      expect(custom.getConfig().checkpointInterval).toBe(5);
    });

    it('should have no active session initially', () => {
      expect(sessionManager.hasActiveSession()).toBe(false);
      expect(sessionManager.getActiveSessionId()).toBeNull();
    });
  });

  // ==========================================================================
  // SESSION LIFECYCLE TESTS
  // ==========================================================================

  describe('create', () => {
    it('should create a new session', () => {
      const sessionId = sessionManager.create(createTestMetadata());

      expect(sessionId).toBeDefined();
      expect(sessionId).toMatch(/^session_/);
    });

    it('should set status to created', () => {
      const sessionId = sessionManager.create(createTestMetadata());
      expect(sessionManager.getStatus(sessionId)).toBe('created');
    });

    it('should store metadata', () => {
      const metadata = createTestMetadata({ projectId: 42 });
      const sessionId = sessionManager.create(metadata);

      const session = sessionManager.getSession(sessionId);
      expect(session.metadata.projectId).toBe(42);
    });

    it('should throw if active session exists', () => {
      const sessionId = sessionManager.create(createTestMetadata());
      sessionManager.start(sessionId);

      expect(() => sessionManager.create(createTestMetadata()))
        .toThrow('Active session exists');
    });

    it('should allow new session if previous is completed', () => {
      const sessionId1 = sessionManager.create(createTestMetadata());
      sessionManager.start(sessionId1);
      sessionManager.complete(sessionId1);

      const sessionId2 = sessionManager.create(createTestMetadata());
      expect(sessionId2).toBeDefined();
    });
  });

  describe('start', () => {
    it('should start a created session', () => {
      const sessionId = sessionManager.create(createTestMetadata());
      sessionManager.start(sessionId);

      expect(sessionManager.getStatus(sessionId)).toBe('running');
    });

    it('should set active session ID', () => {
      const sessionId = sessionManager.create(createTestMetadata());
      sessionManager.start(sessionId);

      expect(sessionManager.getActiveSessionId()).toBe(sessionId);
    });

    it('should set start time', () => {
      const sessionId = sessionManager.create(createTestMetadata());
      const before = new Date();
      sessionManager.start(sessionId);
      const after = new Date();

      const session = sessionManager.getSession(sessionId);
      expect(session.startedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(session.startedAt!.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should throw for non-created session', () => {
      const sessionId = sessionManager.create(createTestMetadata());
      sessionManager.start(sessionId);
      sessionManager.complete(sessionId);

      expect(() => sessionManager.start(sessionId))
        .toThrow('Cannot start session');
    });
  });

  describe('pause', () => {
    it('should pause a running session', () => {
      const sessionId = sessionManager.create(createTestMetadata());
      sessionManager.start(sessionId);
      sessionManager.pause(sessionId);

      expect(sessionManager.getStatus(sessionId)).toBe('paused');
    });

    it('should throw for non-running session', () => {
      const sessionId = sessionManager.create(createTestMetadata());

      expect(() => sessionManager.pause(sessionId))
        .toThrow('Cannot pause session');
    });
  });

  describe('resume', () => {
    it('should resume a paused session', () => {
      const sessionId = sessionManager.create(createTestMetadata());
      sessionManager.start(sessionId);
      sessionManager.pause(sessionId);
      sessionManager.resume(sessionId);

      expect(sessionManager.getStatus(sessionId)).toBe('running');
    });

    it('should track pause duration', async () => {
      const sessionId = sessionManager.create(createTestMetadata());
      sessionManager.start(sessionId);
      sessionManager.pause(sessionId);

      await new Promise(resolve => setTimeout(resolve, 50));

      sessionManager.resume(sessionId);

      const summary = sessionManager.getSummary(sessionId);
      expect(summary.pauseDuration).toBeGreaterThanOrEqual(50);
    });

    it('should throw for non-paused session', () => {
      const sessionId = sessionManager.create(createTestMetadata());
      sessionManager.start(sessionId);

      expect(() => sessionManager.resume(sessionId))
        .toThrow('Cannot resume session');
    });
  });

  describe('stop', () => {
    it('should stop a running session', () => {
      const sessionId = sessionManager.create(createTestMetadata());
      sessionManager.start(sessionId);
      sessionManager.stop(sessionId);

      expect(sessionManager.getStatus(sessionId)).toBe('stopped');
    });

    it('should clear active session', () => {
      const sessionId = sessionManager.create(createTestMetadata());
      sessionManager.start(sessionId);
      sessionManager.stop(sessionId);

      expect(sessionManager.getActiveSessionId()).toBeNull();
    });

    it('should include error message', () => {
      const sessionId = sessionManager.create(createTestMetadata());
      sessionManager.start(sessionId);
      sessionManager.stop(sessionId, 'User cancelled');

      const summary = sessionManager.getSummary(sessionId);
      expect(summary.error).toBe('User cancelled');
    });
  });

  describe('complete', () => {
    it('should complete a running session', () => {
      const sessionId = sessionManager.create(createTestMetadata());
      sessionManager.start(sessionId);
      sessionManager.complete(sessionId);

      expect(sessionManager.getStatus(sessionId)).toBe('completed');
    });

    it('should set end time', () => {
      const sessionId = sessionManager.create(createTestMetadata());
      sessionManager.start(sessionId);
      sessionManager.complete(sessionId);

      const session = sessionManager.getSession(sessionId);
      expect(session.endedAt).toBeDefined();
    });
  });

  describe('fail', () => {
    it('should mark session as failed', () => {
      const sessionId = sessionManager.create(createTestMetadata());
      sessionManager.start(sessionId);
      sessionManager.fail(sessionId, 'Critical error');

      expect(sessionManager.getStatus(sessionId)).toBe('failed');
    });

    it('should store error message', () => {
      const sessionId = sessionManager.create(createTestMetadata());
      sessionManager.start(sessionId);
      sessionManager.fail(sessionId, 'Critical error');

      const summary = sessionManager.getSummary(sessionId);
      expect(summary.error).toBe('Critical error');
    });
  });

  // ==========================================================================
  // CHECKPOINT TESTS
  // ==========================================================================

  describe('checkpoints', () => {
    let sessionId: string;

    beforeEach(() => {
      sessionId = sessionManager.create(createTestMetadata());
      sessionManager.start(sessionId);
    });

    it('should create checkpoint', () => {
      const checkpoint = sessionManager.createCheckpoint(sessionId, {
        rowIndex: 5,
        stepIndex: 2,
        completedRows: [0, 1, 2, 3, 4],
        stepResults: [],
        logs: 'test logs',
        progress: 50,
      });

      expect(checkpoint.id).toMatch(/^cp_/);
      expect(checkpoint.sessionId).toBe(sessionId);
      expect(checkpoint.rowIndex).toBe(5);
    });

    it('should get latest checkpoint', () => {
      sessionManager.createCheckpoint(sessionId, {
        rowIndex: 5,
        stepIndex: 0,
        completedRows: [],
        stepResults: [],
        logs: '',
        progress: 25,
      });

      sessionManager.createCheckpoint(sessionId, {
        rowIndex: 10,
        stepIndex: 0,
        completedRows: [],
        stepResults: [],
        logs: '',
        progress: 50,
      });

      const latest = sessionManager.getLatestCheckpoint(sessionId);
      expect(latest?.rowIndex).toBe(10);
    });

    it('should get all checkpoints', () => {
      sessionManager.createCheckpoint(sessionId, {
        rowIndex: 5,
        stepIndex: 0,
        completedRows: [],
        stepResults: [],
        logs: '',
        progress: 25,
      });

      sessionManager.createCheckpoint(sessionId, {
        rowIndex: 10,
        stepIndex: 0,
        completedRows: [],
        stepResults: [],
        logs: '',
        progress: 50,
      });

      const checkpoints = sessionManager.getCheckpoints(sessionId);
      expect(checkpoints.length).toBe(2);
    });

    it('should return null for no checkpoints', () => {
      expect(sessionManager.getLatestCheckpoint(sessionId)).toBeNull();
    });

    it('should check auto-checkpoint interval', () => {
      expect(sessionManager.shouldAutoCheckpoint(0)).toBe(false);
      expect(sessionManager.shouldAutoCheckpoint(5)).toBe(false);
      expect(sessionManager.shouldAutoCheckpoint(10)).toBe(true);
      expect(sessionManager.shouldAutoCheckpoint(20)).toBe(true);
    });
  });

  describe('resumeFromCheckpoint', () => {
    it('should set status to resuming', () => {
      const sessionId = sessionManager.create(createTestMetadata());
      sessionManager.start(sessionId);
      
      const checkpoint = sessionManager.createCheckpoint(sessionId, {
        rowIndex: 5,
        stepIndex: 0,
        completedRows: [],
        stepResults: [],
        logs: '',
        progress: 50,
      });

      sessionManager.stop(sessionId);
      sessionManager.resumeFromCheckpoint(sessionId, checkpoint);

      expect(sessionManager.getStatus(sessionId)).toBe('resuming');
    });
  });

  // ==========================================================================
  // PROGRESS TRACKING TESTS
  // ==========================================================================

  describe('progress tracking', () => {
    let sessionId: string;

    beforeEach(() => {
      sessionId = sessionManager.create(createTestMetadata());
      sessionManager.start(sessionId);
    });

    it('should update progress', () => {
      sessionManager.updateProgress(sessionId, { rowsProcessed: 5 });

      const summary = sessionManager.getSummary(sessionId);
      expect(summary.rowsProcessed).toBe(5);
    });

    it('should increment step counts', () => {
      sessionManager.incrementStep(sessionId, 'passed');
      sessionManager.incrementStep(sessionId, 'passed');
      sessionManager.incrementStep(sessionId, 'failed');
      sessionManager.incrementStep(sessionId, 'skipped');

      const summary = sessionManager.getSummary(sessionId);
      expect(summary.stepsPassed).toBe(2);
      expect(summary.stepsFailed).toBe(1);
      expect(summary.stepsSkipped).toBe(1);
    });

    it('should complete row', () => {
      sessionManager.completeRow(sessionId);
      sessionManager.completeRow(sessionId);

      const summary = sessionManager.getSummary(sessionId);
      expect(summary.rowsProcessed).toBe(2);
    });
  });

  // ==========================================================================
  // SESSION QUERIES TESTS
  // ==========================================================================

  describe('session queries', () => {
    it('should find session', () => {
      const sessionId = sessionManager.create(createTestMetadata());
      const session = sessionManager.findSession(sessionId);

      expect(session).toBeDefined();
    });

    it('should return undefined for non-existent session', () => {
      expect(sessionManager.findSession('invalid')).toBeUndefined();
    });

    it('should throw getSession for non-existent', () => {
      expect(() => sessionManager.getSession('invalid'))
        .toThrow('Session not found');
    });

    it('should get active session', () => {
      const sessionId = sessionManager.create(createTestMetadata());
      sessionManager.start(sessionId);

      const active = sessionManager.getActiveSession();
      expect(active?.id).toBe(sessionId);
    });

    it('should return null when no active session', () => {
      expect(sessionManager.getActiveSession()).toBeNull();
    });

    it('should get session duration', async () => {
      const sessionId = sessionManager.create(createTestMetadata());
      sessionManager.start(sessionId);

      await new Promise(resolve => setTimeout(resolve, 50));

      const duration = sessionManager.getDuration(sessionId);
      expect(duration).toBeGreaterThanOrEqual(50);
    });

    it('should exclude pause time from duration', async () => {
      const sessionId = sessionManager.create(createTestMetadata());
      sessionManager.start(sessionId);

      await new Promise(resolve => setTimeout(resolve, 30));
      sessionManager.pause(sessionId);
      await new Promise(resolve => setTimeout(resolve, 50));
      sessionManager.resume(sessionId);
      await new Promise(resolve => setTimeout(resolve, 30));

      const duration = sessionManager.getDuration(sessionId);
      // Total time ~110ms, pause ~50ms, active ~60ms
      expect(duration).toBeLessThan(100);
      expect(duration).toBeGreaterThanOrEqual(50);
    });
  });

  // ==========================================================================
  // EVENT TESTS
  // ==========================================================================

  describe('events', () => {
    it('should emit session_created event', () => {
      const listener = vi.fn();
      sessionManager.onEvent(listener);

      sessionManager.create(createTestMetadata());

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'session_created',
        })
      );
    });

    it('should emit session_started event', () => {
      const listener = vi.fn();
      sessionManager.onEvent(listener);

      const sessionId = sessionManager.create(createTestMetadata());
      sessionManager.start(sessionId);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'session_started',
        })
      );
    });

    it('should emit checkpoint_created event', () => {
      const listener = vi.fn();
      sessionManager.onEvent(listener);

      const sessionId = sessionManager.create(createTestMetadata());
      sessionManager.start(sessionId);
      sessionManager.createCheckpoint(sessionId, {
        rowIndex: 5,
        stepIndex: 0,
        completedRows: [],
        stepResults: [],
        logs: '',
        progress: 50,
      });

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'checkpoint_created',
        })
      );
    });

    it('should unsubscribe from events', () => {
      const listener = vi.fn();
      const unsubscribe = sessionManager.onEvent(listener);

      unsubscribe();
      sessionManager.create(createTestMetadata());

      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // PERSISTENCE TESTS
  // ==========================================================================

  describe('persistence', () => {
    it('should save session when persistSessions is true', () => {
      const storage = createMockStorage();
      const manager = new OrchestratorSession(
        { persistSessions: true },
        storage
      );

      manager.create(createTestMetadata());

      expect(storage.saveSession).toHaveBeenCalled();
    });

    it('should save checkpoint when persistSessions is true', () => {
      const storage = createMockStorage();
      const manager = new OrchestratorSession(
        { persistSessions: true },
        storage
      );

      const sessionId = manager.create(createTestMetadata());
      manager.start(sessionId);
      manager.createCheckpoint(sessionId, {
        rowIndex: 5,
        stepIndex: 0,
        completedRows: [],
        stepResults: [],
        logs: '',
        progress: 50,
      });

      expect(storage.saveCheckpoint).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // CLEANUP TESTS
  // ==========================================================================

  describe('cleanup', () => {
    it('should reset all sessions', () => {
      const sessionId = sessionManager.create(createTestMetadata());
      sessionManager.start(sessionId);

      sessionManager.reset();

      expect(sessionManager.hasActiveSession()).toBe(false);
      expect(sessionManager.getAllSessions().length).toBe(0);
    });
  });
});

// ============================================================================
// FACTORY FUNCTION TESTS
// ============================================================================

describe('createOrchestratorSession', () => {
  it('should create instance', () => {
    const manager = createOrchestratorSession({ checkpointInterval: 5 });
    expect(manager).toBeInstanceOf(OrchestratorSession);
    expect(manager.getConfig().checkpointInterval).toBe(5);
  });
});
