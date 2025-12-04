/**
 * StorageHandlers - Unified storage operation message handlers
 * @module background/handlers/StorageHandlers
 * @version 1.0.0
 * 
 * Coordinates storage operations:
 * - Project CRUD via ProjectHandlers
 * - TestRun CRUD via TestRunHandlers  
 * - Storage utilities (quota, backup, restore, clear)
 * - Settings management
 * 
 * @see storage-layer_breakdown.md for storage patterns
 */

import type { MessageReceiver, MessageHandler, ActionCategory } from '../MessageReceiver';
import type { BackgroundMessage, BackgroundResponse, MessageSender } from '../IBackgroundService';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Settings storage interface
 */
export interface ISettingsStorage {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  getAll(): Promise<Record<string, unknown>>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Project storage interface (from ProjectHandlers)
 */
export interface IProjectStorage {
  addProject(project: Omit<Project, 'id'>): Promise<number>;
  updateProject(id: number, updates: Partial<Project>): Promise<void>;
  getAllProjects(): Promise<Project[]>;
  getProjectById(id: number): Promise<Project | undefined>;
  deleteProject(id: number): Promise<void>;
}

/**
 * TestRun storage interface (from TestRunHandlers)
 */
export interface ITestRunStorage {
  createTestRun(run: Omit<TestRun, 'id'>): Promise<number>;
  updateTestRun(id: number, updates: Partial<TestRun>): Promise<void>;
  getTestRunById(id: number): Promise<TestRun | undefined>;
  getTestRunsByProject(projectId: number): Promise<TestRun[]>;
  deleteTestRun(id: number): Promise<void>;
  getRecentTestRuns(limit: number): Promise<TestRun[]>;
}

/**
 * Project data model
 */
export interface Project {
  id?: number;
  name: string;
  description?: string;
  target_url: string;
  status: 'draft' | 'testing' | 'complete';
  created_date: string;
  updated_date: string;
  recorded_steps: RecordedStep[];
  parsed_fields: ParsedField[];
  csv_data: Record<string, string>[];
}

/**
 * TestRun data model
 */
export interface TestRun {
  id?: number;
  project_id: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'stopped';
  start_time: string;
  end_time?: string;
  total_steps: number;
  passed_steps: number;
  failed_steps: number;
  skipped_steps: number;
  total_rows: number;
  completed_rows: number;
  test_results: StepResult[];
  logs: string;
  error_message?: string;
}

/**
 * Recorded step (simplified)
 */
export interface RecordedStep {
  eventType: string;
  xpath: string;
  value?: string;
  label?: string;
  bundle: Record<string, unknown>;
}

/**
 * Parsed field mapping
 */
export interface ParsedField {
  stepIndex: number;
  fieldName: string;
  csvColumn: string;
}

/**
 * Step result
 */
export interface StepResult {
  stepIndex: number;
  rowIndex: number;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
}

/**
 * Storage quota info
 */
export interface StorageQuotaInfo {
  quota: number;
  usage: number;
  percentUsed: number;
  available: number;
  persisted: boolean;
}

/**
 * Backup data structure
 */
export interface StorageBackup {
  version: number;
  timestamp: string;
  projects: Project[];
  testRuns: TestRun[];
  settings: Record<string, unknown>;
}

/**
 * Storage event types
 */
export type StorageEventType =
  | 'project_created'
  | 'project_updated'
  | 'project_deleted'
  | 'testrun_created'
  | 'testrun_updated'
  | 'testrun_deleted'
  | 'settings_changed'
  | 'storage_cleared'
  | 'backup_created'
  | 'backup_restored';

/**
 * Storage event
 */
export interface StorageEvent {
  type: StorageEventType;
  timestamp: Date;
  entityType?: 'project' | 'testrun' | 'settings';
  entityId?: number;
  key?: string;
}

/**
 * Storage event listener
 */
export type StorageEventListener = (event: StorageEvent) => void;

/**
 * Storage action constants
 */
export const STORAGE_ACTIONS = {
  // Utility actions
  GET_STORAGE_QUOTA: 'get_storage_quota',
  REQUEST_PERSISTENCE: 'request_persistence',
  CLEAR_ALL_DATA: 'clear_all_data',
  CREATE_BACKUP: 'create_backup',
  RESTORE_BACKUP: 'restore_backup',
  // Settings actions
  GET_SETTING: 'get_setting',
  SET_SETTING: 'set_setting',
  GET_ALL_SETTINGS: 'get_all_settings',
  REMOVE_SETTING: 'remove_setting',
  // Bulk operations
  DELETE_PROJECT_CASCADE: 'delete_project_cascade',
  GET_PROJECT_WITH_RUNS: 'get_project_with_runs',
  GET_STORAGE_STATS: 'get_storage_stats',
} as const;

/**
 * Current backup version
 */
export const BACKUP_VERSION = 1;

// ============================================================================
// STORAGE HANDLERS CLASS
// ============================================================================

/**
 * StorageHandlers - Unified storage operation handlers
 * 
 * @example
 * ```typescript
 * const handlers = new StorageHandlers(
 *   projectStorage,
 *   testRunStorage,
 *   settingsStorage,
 *   navigatorStorage
 * );
 * handlers.registerAll(messageReceiver);
 * ```
 */
export class StorageHandlers {
  private projectStorage: IProjectStorage;
  private testRunStorage: ITestRunStorage;
  private settingsStorage: ISettingsStorage;
  private navigatorStorage: NavigatorStorage | null;

  // Event listeners
  private eventListeners: Set<StorageEventListener> = new Set();

  // Statistics
  private stats = {
    projectOperations: 0,
    testRunOperations: 0,
    settingsOperations: 0,
    backupsCreated: 0,
    backupsRestored: 0,
  };

  /**
   * Create StorageHandlers
   */
  constructor(
    projectStorage: IProjectStorage,
    testRunStorage: ITestRunStorage,
    settingsStorage: ISettingsStorage,
    navigatorStorage?: NavigatorStorage | null
  ) {
    this.projectStorage = projectStorage;
    this.testRunStorage = testRunStorage;
    this.settingsStorage = settingsStorage;
    this.navigatorStorage = navigatorStorage ?? this.getDefaultNavigatorStorage();
  }

  // ==========================================================================
  // HANDLER REGISTRATION
  // ==========================================================================

  /**
   * Register all handlers with message receiver
   */
  public registerAll(receiver: MessageReceiver): void {
    // Utility handlers
    receiver.register(
      STORAGE_ACTIONS.GET_STORAGE_QUOTA,
      this.handleGetStorageQuota.bind(this),
      'storage'
    );
    receiver.register(
      STORAGE_ACTIONS.REQUEST_PERSISTENCE,
      this.handleRequestPersistence.bind(this),
      'storage'
    );
    receiver.register(
      STORAGE_ACTIONS.CLEAR_ALL_DATA,
      this.handleClearAllData.bind(this),
      'storage'
    );
    receiver.register(
      STORAGE_ACTIONS.CREATE_BACKUP,
      this.handleCreateBackup.bind(this),
      'storage'
    );
    receiver.register(
      STORAGE_ACTIONS.RESTORE_BACKUP,
      this.handleRestoreBackup.bind(this),
      'storage'
    );

    // Settings handlers
    receiver.register(
      STORAGE_ACTIONS.GET_SETTING,
      this.handleGetSetting.bind(this),
      'storage'
    );
    receiver.register(
      STORAGE_ACTIONS.SET_SETTING,
      this.handleSetSetting.bind(this),
      'storage'
    );
    receiver.register(
      STORAGE_ACTIONS.GET_ALL_SETTINGS,
      this.handleGetAllSettings.bind(this),
      'storage'
    );
    receiver.register(
      STORAGE_ACTIONS.REMOVE_SETTING,
      this.handleRemoveSetting.bind(this),
      'storage'
    );

    // Bulk operation handlers
    receiver.register(
      STORAGE_ACTIONS.DELETE_PROJECT_CASCADE,
      this.handleDeleteProjectCascade.bind(this),
      'storage'
    );
    receiver.register(
      STORAGE_ACTIONS.GET_PROJECT_WITH_RUNS,
      this.handleGetProjectWithRuns.bind(this),
      'storage'
    );
    receiver.register(
      STORAGE_ACTIONS.GET_STORAGE_STATS,
      this.handleGetStorageStats.bind(this),
      'storage'
    );
  }

  /**
   * Get handler entries for manual registration
   */
  public getHandlerEntries(): Array<{
    action: string;
    handler: MessageHandler;
    category: ActionCategory;
  }> {
    return [
      { action: STORAGE_ACTIONS.GET_STORAGE_QUOTA, handler: this.handleGetStorageQuota.bind(this), category: 'storage' },
      { action: STORAGE_ACTIONS.REQUEST_PERSISTENCE, handler: this.handleRequestPersistence.bind(this), category: 'storage' },
      { action: STORAGE_ACTIONS.CLEAR_ALL_DATA, handler: this.handleClearAllData.bind(this), category: 'storage' },
      { action: STORAGE_ACTIONS.CREATE_BACKUP, handler: this.handleCreateBackup.bind(this), category: 'storage' },
      { action: STORAGE_ACTIONS.RESTORE_BACKUP, handler: this.handleRestoreBackup.bind(this), category: 'storage' },
      { action: STORAGE_ACTIONS.GET_SETTING, handler: this.handleGetSetting.bind(this), category: 'storage' },
      { action: STORAGE_ACTIONS.SET_SETTING, handler: this.handleSetSetting.bind(this), category: 'storage' },
      { action: STORAGE_ACTIONS.GET_ALL_SETTINGS, handler: this.handleGetAllSettings.bind(this), category: 'storage' },
      { action: STORAGE_ACTIONS.REMOVE_SETTING, handler: this.handleRemoveSetting.bind(this), category: 'storage' },
      { action: STORAGE_ACTIONS.DELETE_PROJECT_CASCADE, handler: this.handleDeleteProjectCascade.bind(this), category: 'storage' },
      { action: STORAGE_ACTIONS.GET_PROJECT_WITH_RUNS, handler: this.handleGetProjectWithRuns.bind(this), category: 'storage' },
      { action: STORAGE_ACTIONS.GET_STORAGE_STATS, handler: this.handleGetStorageStats.bind(this), category: 'storage' },
    ];
  }

  // ==========================================================================
  // QUOTA AND PERSISTENCE HANDLERS
  // ==========================================================================

  /**
   * Handle get_storage_quota
   */
  public async handleGetStorageQuota(
    _message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      if (!this.navigatorStorage) {
        return {
          success: false,
          error: 'Storage API not available',
        };
      }

      const estimate = await this.navigatorStorage.estimate();
      const persisted = await this.navigatorStorage.persisted();

      const quota = estimate.quota ?? 0;
      const usage = estimate.usage ?? 0;

      const info: StorageQuotaInfo = {
        quota,
        usage,
        percentUsed: quota > 0 ? Math.round((usage / quota) * 100) : 0,
        available: quota - usage,
        persisted,
      };

      return {
        success: true,
        data: info,
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get storage quota',
      };
    }
  }

  /**
   * Handle request_persistence
   */
  public async handleRequestPersistence(
    _message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      if (!this.navigatorStorage) {
        return {
          success: false,
          error: 'Storage API not available',
        };
      }

      const granted = await this.navigatorStorage.persist();

      return {
        success: true,
        data: { persisted: granted },
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to request persistence',
      };
    }
  }

  // ==========================================================================
  // BACKUP/RESTORE HANDLERS
  // ==========================================================================

  /**
   * Handle create_backup
   */
  public async handleCreateBackup(
    _message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      const projects = await this.projectStorage.getAllProjects();
      
      // Get all test runs for all projects
      const testRuns: TestRun[] = [];
      for (const project of projects) {
        if (project.id) {
          const runs = await this.testRunStorage.getTestRunsByProject(project.id);
          testRuns.push(...runs);
        }
      }

      const settings = await this.settingsStorage.getAll();

      const backup: StorageBackup = {
        version: BACKUP_VERSION,
        timestamp: new Date().toISOString(),
        projects,
        testRuns,
        settings,
      };

      this.stats.backupsCreated++;
      this.emitEvent({
        type: 'backup_created',
        timestamp: new Date(),
      });

      return {
        success: true,
        data: { backup },
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create backup',
      };
    }
  }

  /**
   * Handle restore_backup
   */
  public async handleRestoreBackup(
    message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      const payload = message.payload as { backup: StorageBackup; clearExisting?: boolean } | undefined;

      if (!payload?.backup) {
        return { success: false, error: 'backup is required' };
      }

      const backup = payload.backup;

      // Validate backup version
      if (backup.version > BACKUP_VERSION) {
        return {
          success: false,
          error: `Backup version ${backup.version} is newer than supported version ${BACKUP_VERSION}`,
        };
      }

      // Clear existing data if requested
      if (payload.clearExisting) {
        await this.clearAllStorageData();
      }

      // Restore projects
      const projectIdMap = new Map<number, number>(); // Old ID -> New ID
      for (const project of backup.projects) {
        const oldId = project.id;
        const { id: _, ...projectData } = project;
        const newId = await this.projectStorage.addProject(projectData as Omit<Project, 'id'>);
        if (oldId) {
          projectIdMap.set(oldId, newId);
        }
      }

      // Restore test runs with remapped project IDs
      for (const testRun of backup.testRuns) {
        const newProjectId = projectIdMap.get(testRun.project_id);
        if (newProjectId) {
          const { id: _, ...runData } = testRun;
          await this.testRunStorage.createTestRun({
            ...runData,
            project_id: newProjectId,
          } as Omit<TestRun, 'id'>);
        }
      }

      // Restore settings
      for (const [key, value] of Object.entries(backup.settings)) {
        await this.settingsStorage.set(key, value);
      }

      this.stats.backupsRestored++;
      this.emitEvent({
        type: 'backup_restored',
        timestamp: new Date(),
      });

      return {
        success: true,
        data: {
          projectsRestored: backup.projects.length,
          testRunsRestored: backup.testRuns.length,
          settingsRestored: Object.keys(backup.settings).length,
        },
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to restore backup',
      };
    }
  }

  /**
   * Handle clear_all_data
   */
  public async handleClearAllData(
    _message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      await this.clearAllStorageData();

      this.emitEvent({
        type: 'storage_cleared',
        timestamp: new Date(),
      });

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to clear data',
      };
    }
  }

  /**
   * Clear all storage data
   */
  private async clearAllStorageData(): Promise<void> {
    // Get all projects
    const projects = await this.projectStorage.getAllProjects();

    // Delete all test runs for each project
    for (const project of projects) {
      if (project.id) {
        const runs = await this.testRunStorage.getTestRunsByProject(project.id);
        for (const run of runs) {
          if (run.id) {
            await this.testRunStorage.deleteTestRun(run.id);
          }
        }
        // Delete project
        await this.projectStorage.deleteProject(project.id);
      }
    }

    // Clear settings
    await this.settingsStorage.clear();
  }

  // ==========================================================================
  // SETTINGS HANDLERS
  // ==========================================================================

  /**
   * Handle get_setting
   */
  public async handleGetSetting(
    message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      const payload = message.payload as { key: string } | undefined;

      if (!payload?.key) {
        return { success: false, error: 'key is required' };
      }

      const value = await this.settingsStorage.get(payload.key);
      this.stats.settingsOperations++;

      return {
        success: true,
        data: { key: payload.key, value },
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get setting',
      };
    }
  }

  /**
   * Handle set_setting
   */
  public async handleSetSetting(
    message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      const payload = message.payload as { key: string; value: unknown } | undefined;

      if (!payload?.key) {
        return { success: false, error: 'key is required' };
      }

      await this.settingsStorage.set(payload.key, payload.value);
      this.stats.settingsOperations++;

      this.emitEvent({
        type: 'settings_changed',
        timestamp: new Date(),
        entityType: 'settings',
        key: payload.key,
      });

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set setting',
      };
    }
  }

  /**
   * Handle get_all_settings
   */
  public async handleGetAllSettings(
    _message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      const settings = await this.settingsStorage.getAll();
      this.stats.settingsOperations++;

      return {
        success: true,
        data: { settings },
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get settings',
      };
    }
  }

  /**
   * Handle remove_setting
   */
  public async handleRemoveSetting(
    message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      const payload = message.payload as { key: string } | undefined;

      if (!payload?.key) {
        return { success: false, error: 'key is required' };
      }

      await this.settingsStorage.remove(payload.key);
      this.stats.settingsOperations++;

      this.emitEvent({
        type: 'settings_changed',
        timestamp: new Date(),
        entityType: 'settings',
        key: payload.key,
      });

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove setting',
      };
    }
  }

  // ==========================================================================
  // BULK OPERATION HANDLERS
  // ==========================================================================

  /**
   * Handle delete_project_cascade - Delete project and all related test runs
   */
  public async handleDeleteProjectCascade(
    message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      const payload = message.payload as { projectId: number } | undefined;

      if (!payload?.projectId) {
        return { success: false, error: 'projectId is required' };
      }

      // Get all test runs for project
      const testRuns = await this.testRunStorage.getTestRunsByProject(payload.projectId);

      // Delete test runs
      let deletedRuns = 0;
      for (const run of testRuns) {
        if (run.id) {
          await this.testRunStorage.deleteTestRun(run.id);
          deletedRuns++;
        }
      }

      // Delete project
      await this.projectStorage.deleteProject(payload.projectId);

      this.stats.projectOperations++;
      this.stats.testRunOperations += deletedRuns;

      this.emitEvent({
        type: 'project_deleted',
        timestamp: new Date(),
        entityType: 'project',
        entityId: payload.projectId,
      });

      return {
        success: true,
        data: {
          projectId: payload.projectId,
          deletedTestRuns: deletedRuns,
        },
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete project',
      };
    }
  }

  /**
   * Handle get_project_with_runs - Get project with all its test runs
   */
  public async handleGetProjectWithRuns(
    message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      const payload = message.payload as { projectId: number } | undefined;

      if (!payload?.projectId) {
        return { success: false, error: 'projectId is required' };
      }

      const project = await this.projectStorage.getProjectById(payload.projectId);
      
      if (!project) {
        return { success: false, error: `Project not found: ${payload.projectId}` };
      }

      const testRuns = await this.testRunStorage.getTestRunsByProject(payload.projectId);

      this.stats.projectOperations++;
      this.stats.testRunOperations++;

      return {
        success: true,
        data: {
          project,
          testRuns,
        },
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get project',
      };
    }
  }

  /**
   * Handle get_storage_stats - Get overall storage statistics
   */
  public async handleGetStorageStats(
    _message: BackgroundMessage,
    _sender: MessageSender
  ): Promise<BackgroundResponse> {
    try {
      const projects = await this.projectStorage.getAllProjects();
      
      let totalTestRuns = 0;
      let totalSteps = 0;
      let totalCsvRows = 0;

      for (const project of projects) {
        if (project.id) {
          const runs = await this.testRunStorage.getTestRunsByProject(project.id);
          totalTestRuns += runs.length;
        }
        totalSteps += project.recorded_steps?.length ?? 0;
        totalCsvRows += project.csv_data?.length ?? 0;
      }

      // Get quota info if available
      let quotaInfo: Partial<StorageQuotaInfo> = {};
      if (this.navigatorStorage) {
        try {
          const estimate = await this.navigatorStorage.estimate();
          const persisted = await this.navigatorStorage.persisted();
          quotaInfo = {
            quota: estimate.quota,
            usage: estimate.usage,
            persisted,
          };
        } catch {
          // Ignore quota errors
        }
      }

      return {
        success: true,
        data: {
          projects: {
            count: projects.length,
            totalSteps,
            totalCsvRows,
          },
          testRuns: {
            count: totalTestRuns,
          },
          quota: quotaInfo,
          operationStats: this.stats,
        },
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get storage stats',
      };
    }
  }

  // ==========================================================================
  // STATE ACCESS
  // ==========================================================================

  /**
   * Get statistics
   */
  public getStats(): typeof this.stats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  public resetStats(): void {
    this.stats = {
      projectOperations: 0,
      testRunOperations: 0,
      settingsOperations: 0,
      backupsCreated: 0,
      backupsRestored: 0,
    };
  }

  // ==========================================================================
  // EVENTS
  // ==========================================================================

  /**
   * Subscribe to storage events
   */
  public onEvent(listener: StorageEventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /**
   * Emit event
   */
  private emitEvent(event: StorageEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[StorageHandlers] Error in event listener:', error);
      }
    });
  }

  // ==========================================================================
  // DEFAULT STORAGE
  // ==========================================================================

  private getDefaultNavigatorStorage(): NavigatorStorage | null {
    if (typeof navigator !== 'undefined' && navigator.storage) {
      return navigator.storage;
    }
    return null;
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create StorageHandlers instance
 */
export function createStorageHandlers(
  projectStorage: IProjectStorage,
  testRunStorage: ITestRunStorage,
  settingsStorage: ISettingsStorage,
  navigatorStorage?: NavigatorStorage | null
): StorageHandlers {
  return new StorageHandlers(projectStorage, testRunStorage, settingsStorage, navigatorStorage);
}

/**
 * Create and register StorageHandlers
 */
export function registerStorageHandlers(
  receiver: MessageReceiver,
  projectStorage: IProjectStorage,
  testRunStorage: ITestRunStorage,
  settingsStorage: ISettingsStorage,
  navigatorStorage?: NavigatorStorage | null
): StorageHandlers {
  const handlers = new StorageHandlers(projectStorage, testRunStorage, settingsStorage, navigatorStorage);
  handlers.registerAll(receiver);
  return handlers;
}
