/**
 * Tests for StorageHandlers
 * @module background/handlers/StorageHandlers.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  StorageHandlers,
  createStorageHandlers,
  registerStorageHandlers,
  STORAGE_ACTIONS,
  BACKUP_VERSION,
  type IProjectStorage,
  type ITestRunStorage,
  type ISettingsStorage,
  type Project,
  type TestRun,
  type StorageBackup,
  type StorageEvent,
} from './StorageHandlers';
import { MessageReceiver } from '../MessageReceiver';
import { BackgroundConfig } from '../BackgroundConfig';

// ============================================================================
// MOCK FACTORIES
// ============================================================================

function createMockProjectStorage(): IProjectStorage & {
  _projects: Map<number, Project>;
} {
  let nextId = 1;
  const projects = new Map<number, Project>();

  return {
    _projects: projects,
    addProject: vi.fn(async (project) => {
      const id = nextId++;
      projects.set(id, { ...project, id });
      return id;
    }),
    updateProject: vi.fn(async (id, updates) => {
      const existing = projects.get(id);
      if (existing) {
        projects.set(id, { ...existing, ...updates });
      }
    }),
    getAllProjects: vi.fn(async () => Array.from(projects.values())),
    getProjectById: vi.fn(async (id) => projects.get(id)),
    deleteProject: vi.fn(async (id) => {
      projects.delete(id);
    }),
  };
}

function createMockTestRunStorage(): ITestRunStorage & {
  _runs: Map<number, TestRun>;
} {
  let nextId = 1;
  const runs = new Map<number, TestRun>();

  return {
    _runs: runs,
    createTestRun: vi.fn(async (run) => {
      const id = nextId++;
      runs.set(id, { ...run, id });
      return id;
    }),
    updateTestRun: vi.fn(async (id, updates) => {
      const existing = runs.get(id);
      if (existing) {
        runs.set(id, { ...existing, ...updates });
      }
    }),
    getTestRunById: vi.fn(async (id) => runs.get(id)),
    getTestRunsByProject: vi.fn(async (projectId) =>
      Array.from(runs.values()).filter(r => r.project_id === projectId)
    ),
    deleteTestRun: vi.fn(async (id) => {
      runs.delete(id);
    }),
    getRecentTestRuns: vi.fn(async (limit) =>
      Array.from(runs.values()).slice(0, limit)
    ),
  };
}

function createMockSettingsStorage(): ISettingsStorage & {
  _settings: Map<string, unknown>;
} {
  const settings = new Map<string, unknown>();

  return {
    _settings: settings,
    get: vi.fn(async (key) => settings.get(key)),
    set: vi.fn(async (key, value) => {
      settings.set(key, value);
    }),
    getAll: vi.fn(async () => Object.fromEntries(settings)),
    remove: vi.fn(async (key) => {
      settings.delete(key);
    }),
    clear: vi.fn(async () => {
      settings.clear();
    }),
  };
}

function createMockNavigatorStorage(): NavigatorStorage {
  return {
    estimate: vi.fn(async () => ({
      quota: 100000000,
      usage: 5000000,
    })),
    persist: vi.fn(async () => true),
    persisted: vi.fn(async () => true),
    getDirectory: vi.fn(),
  };
}

function createMockSender(): { tab?: { id: number } } {
  return {};
}

function createMockProject(id: number, name: string = 'Test Project'): Project {
  return {
    id,
    name,
    target_url: 'https://example.com',
    status: 'draft',
    created_date: new Date().toISOString(),
    updated_date: new Date().toISOString(),
    recorded_steps: [],
    parsed_fields: [],
    csv_data: [],
  };
}

function createMockTestRun(id: number, projectId: number): TestRun {
  return {
    id,
    project_id: projectId,
    status: 'completed',
    start_time: new Date().toISOString(),
    total_steps: 5,
    passed_steps: 4,
    failed_steps: 1,
    skipped_steps: 0,
    total_rows: 1,
    completed_rows: 1,
    test_results: [],
    logs: '',
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('StorageHandlers', () => {
  let handlers: StorageHandlers;
  let projectStorage: ReturnType<typeof createMockProjectStorage>;
  let testRunStorage: ReturnType<typeof createMockTestRunStorage>;
  let settingsStorage: ReturnType<typeof createMockSettingsStorage>;
  let navigatorStorage: NavigatorStorage;

  beforeEach(() => {
    projectStorage = createMockProjectStorage();
    testRunStorage = createMockTestRunStorage();
    settingsStorage = createMockSettingsStorage();
    navigatorStorage = createMockNavigatorStorage();
    handlers = new StorageHandlers(
      projectStorage,
      testRunStorage,
      settingsStorage,
      navigatorStorage
    );
    vi.clearAllMocks();
  });

  // ==========================================================================
  // QUOTA TESTS
  // ==========================================================================

  describe('handleGetStorageQuota', () => {
    it('should get storage quota info', async () => {
      const response = await handlers.handleGetStorageQuota(
        { action: 'get_storage_quota', payload: {} },
        createMockSender()
      );

      expect(response.success).toBe(true);
      expect(response.data?.quota).toBe(100000000);
      expect(response.data?.usage).toBe(5000000);
      expect(response.data?.percentUsed).toBe(5);
      expect(response.data?.persisted).toBe(true);
    });
  });

  describe('handleRequestPersistence', () => {
    it('should request persistence', async () => {
      const response = await handlers.handleRequestPersistence(
        { action: 'request_persistence', payload: {} },
        createMockSender()
      );

      expect(response.success).toBe(true);
      expect(response.data?.persisted).toBe(true);
      expect(navigatorStorage.persist).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // BACKUP TESTS
  // ==========================================================================

  describe('handleCreateBackup', () => {
    beforeEach(async () => {
      projectStorage._projects.set(1, createMockProject(1, 'Project 1'));
      projectStorage._projects.set(2, createMockProject(2, 'Project 2'));
      testRunStorage._runs.set(1, createMockTestRun(1, 1));
      settingsStorage._settings.set('theme', 'dark');
    });

    it('should create backup', async () => {
      const response = await handlers.handleCreateBackup(
        { action: 'create_backup', payload: {} },
        createMockSender()
      );

      expect(response.success).toBe(true);
      expect(response.data?.backup).toBeDefined();
      expect(response.data?.backup.version).toBe(BACKUP_VERSION);
      expect(response.data?.backup.projects).toHaveLength(2);
      expect(response.data?.backup.testRuns).toHaveLength(1);
      expect(response.data?.backup.settings.theme).toBe('dark');
    });

    it('should track statistics', async () => {
      await handlers.handleCreateBackup(
        { action: 'create_backup', payload: {} },
        createMockSender()
      );

      expect(handlers.getStats().backupsCreated).toBe(1);
    });
  });

  describe('handleRestoreBackup', () => {
    it('should restore backup', async () => {
      const backup: StorageBackup = {
        version: BACKUP_VERSION,
        timestamp: new Date().toISOString(),
        projects: [
          createMockProject(1, 'Restored Project'),
        ],
        testRuns: [
          createMockTestRun(1, 1),
        ],
        settings: { theme: 'light' },
      };

      const response = await handlers.handleRestoreBackup(
        {
          action: 'restore_backup',
          payload: { backup, clearExisting: true },
        },
        createMockSender()
      );

      expect(response.success).toBe(true);
      expect(response.data?.projectsRestored).toBe(1);
      expect(response.data?.testRunsRestored).toBe(1);
      expect(response.data?.settingsRestored).toBe(1);
    });

    it('should require backup', async () => {
      const response = await handlers.handleRestoreBackup(
        { action: 'restore_backup', payload: {} },
        createMockSender()
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('backup is required');
    });

    it('should reject newer backup versions', async () => {
      const backup: StorageBackup = {
        version: BACKUP_VERSION + 1,
        timestamp: new Date().toISOString(),
        projects: [],
        testRuns: [],
        settings: {},
      };

      const response = await handlers.handleRestoreBackup(
        { action: 'restore_backup', payload: { backup } },
        createMockSender()
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('newer');
    });
  });

  describe('handleClearAllData', () => {
    beforeEach(() => {
      projectStorage._projects.set(1, createMockProject(1));
      testRunStorage._runs.set(1, createMockTestRun(1, 1));
      settingsStorage._settings.set('key', 'value');
    });

    it('should clear all data', async () => {
      const response = await handlers.handleClearAllData(
        { action: 'clear_all_data', payload: {} },
        createMockSender()
      );

      expect(response.success).toBe(true);
      expect(projectStorage.deleteProject).toHaveBeenCalled();
      expect(testRunStorage.deleteTestRun).toHaveBeenCalled();
      expect(settingsStorage.clear).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // SETTINGS TESTS
  // ==========================================================================

  describe('handleGetSetting', () => {
    it('should get setting', async () => {
      settingsStorage._settings.set('theme', 'dark');

      const response = await handlers.handleGetSetting(
        { action: 'get_setting', payload: { key: 'theme' } },
        createMockSender()
      );

      expect(response.success).toBe(true);
      expect(response.data?.value).toBe('dark');
    });

    it('should require key', async () => {
      const response = await handlers.handleGetSetting(
        { action: 'get_setting', payload: {} },
        createMockSender()
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('key');
    });
  });

  describe('handleSetSetting', () => {
    it('should set setting', async () => {
      const response = await handlers.handleSetSetting(
        { action: 'set_setting', payload: { key: 'theme', value: 'light' } },
        createMockSender()
      );

      expect(response.success).toBe(true);
      expect(settingsStorage._settings.get('theme')).toBe('light');
    });
  });

  describe('handleGetAllSettings', () => {
    it('should get all settings', async () => {
      settingsStorage._settings.set('key1', 'value1');
      settingsStorage._settings.set('key2', 'value2');

      const response = await handlers.handleGetAllSettings(
        { action: 'get_all_settings', payload: {} },
        createMockSender()
      );

      expect(response.success).toBe(true);
      expect(response.data?.settings.key1).toBe('value1');
      expect(response.data?.settings.key2).toBe('value2');
    });
  });

  describe('handleRemoveSetting', () => {
    it('should remove setting', async () => {
      settingsStorage._settings.set('theme', 'dark');

      const response = await handlers.handleRemoveSetting(
        { action: 'remove_setting', payload: { key: 'theme' } },
        createMockSender()
      );

      expect(response.success).toBe(true);
      expect(settingsStorage._settings.has('theme')).toBe(false);
    });
  });

  // ==========================================================================
  // BULK OPERATION TESTS
  // ==========================================================================

  describe('handleDeleteProjectCascade', () => {
    beforeEach(() => {
      projectStorage._projects.set(1, createMockProject(1));
      testRunStorage._runs.set(1, createMockTestRun(1, 1));
      testRunStorage._runs.set(2, createMockTestRun(2, 1));
    });

    it('should delete project and test runs', async () => {
      const response = await handlers.handleDeleteProjectCascade(
        { action: 'delete_project_cascade', payload: { projectId: 1 } },
        createMockSender()
      );

      expect(response.success).toBe(true);
      expect(response.data?.deletedTestRuns).toBe(2);
      expect(projectStorage.deleteProject).toHaveBeenCalledWith(1);
    });

    it('should require projectId', async () => {
      const response = await handlers.handleDeleteProjectCascade(
        { action: 'delete_project_cascade', payload: {} },
        createMockSender()
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('projectId');
    });
  });

  describe('handleGetProjectWithRuns', () => {
    beforeEach(() => {
      projectStorage._projects.set(1, createMockProject(1, 'Test'));
      testRunStorage._runs.set(1, createMockTestRun(1, 1));
    });

    it('should get project with runs', async () => {
      const response = await handlers.handleGetProjectWithRuns(
        { action: 'get_project_with_runs', payload: { projectId: 1 } },
        createMockSender()
      );

      expect(response.success).toBe(true);
      expect(response.data?.project.name).toBe('Test');
      expect(response.data?.testRuns).toHaveLength(1);
    });

    it('should handle not found', async () => {
      const response = await handlers.handleGetProjectWithRuns(
        { action: 'get_project_with_runs', payload: { projectId: 999 } },
        createMockSender()
      );

      expect(response.success).toBe(false);
      expect(response.error).toContain('not found');
    });
  });

  describe('handleGetStorageStats', () => {
    beforeEach(() => {
      projectStorage._projects.set(1, {
        ...createMockProject(1),
        recorded_steps: [{ eventType: 'click', xpath: '', bundle: {} }],
        csv_data: [{ name: 'John' }],
      });
      testRunStorage._runs.set(1, createMockTestRun(1, 1));
    });

    it('should get storage stats', async () => {
      const response = await handlers.handleGetStorageStats(
        { action: 'get_storage_stats', payload: {} },
        createMockSender()
      );

      expect(response.success).toBe(true);
      expect(response.data?.projects.count).toBe(1);
      expect(response.data?.projects.totalSteps).toBe(1);
      expect(response.data?.projects.totalCsvRows).toBe(1);
      expect(response.data?.testRuns.count).toBe(1);
    });
  });

  // ==========================================================================
  // EVENT TESTS
  // ==========================================================================

  describe('events', () => {
    it('should emit backup_created event', async () => {
      const events: StorageEvent[] = [];
      handlers.onEvent(e => events.push(e));

      await handlers.handleCreateBackup(
        { action: 'create_backup', payload: {} },
        createMockSender()
      );

      expect(events.some(e => e.type === 'backup_created')).toBe(true);
    });

    it('should emit settings_changed event', async () => {
      const events: StorageEvent[] = [];
      handlers.onEvent(e => events.push(e));

      await handlers.handleSetSetting(
        { action: 'set_setting', payload: { key: 'theme', value: 'dark' } },
        createMockSender()
      );

      expect(events.some(e => e.type === 'settings_changed')).toBe(true);
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

      expect(receiver.hasHandler(STORAGE_ACTIONS.GET_STORAGE_QUOTA)).toBe(true);
      expect(receiver.hasHandler(STORAGE_ACTIONS.CREATE_BACKUP)).toBe(true);
      expect(receiver.hasHandler(STORAGE_ACTIONS.GET_SETTING)).toBe(true);
    });

    it('should get handler entries', () => {
      const entries = handlers.getHandlerEntries();

      expect(entries).toHaveLength(12);
      expect(entries.every(e => e.category === 'storage')).toBe(true);
    });
  });
});

// ============================================================================
// FACTORY FUNCTION TESTS
// ============================================================================

describe('createStorageHandlers', () => {
  it('should create instance', () => {
    const handlers = createStorageHandlers(
      createMockProjectStorage(),
      createMockTestRunStorage(),
      createMockSettingsStorage()
    );

    expect(handlers).toBeInstanceOf(StorageHandlers);
  });
});

describe('registerStorageHandlers', () => {
  it('should create and register handlers', () => {
    const config = new BackgroundConfig();
    const receiver = new MessageReceiver(config);

    const handlers = registerStorageHandlers(
      receiver,
      createMockProjectStorage(),
      createMockTestRunStorage(),
      createMockSettingsStorage()
    );

    expect(handlers).toBeInstanceOf(StorageHandlers);
    expect(receiver.hasHandler(STORAGE_ACTIONS.GET_STORAGE_QUOTA)).toBe(true);
  });
});
