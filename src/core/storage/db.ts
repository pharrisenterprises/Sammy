/**
 * @fileoverview IndexedDB database wrapper for persistent storage
 * @module core/storage/db
 * @version 1.0.0
 * 
 * This module provides a typed IndexedDB wrapper for storing Projects and TestRuns.
 * Uses the singleton pattern to ensure a single database connection.
 * 
 * @see PHASE_4_SPECIFICATIONS.md Section 3 for storage specifications
 * @see storage-layer_breakdown.md for architecture details
 */

import type { Project, TestRun } from '../types';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Database name
 */
export const DB_NAME = 'SammyTestRecorderDB';

/**
 * Current database version
 * Increment when schema changes require migration
 */
export const DB_VERSION = 1;

/**
 * Object store names
 */
export const STORES = {
  PROJECTS: 'projects',
  TEST_RUNS: 'testRuns'
} as const;

export type StoreName = typeof STORES[keyof typeof STORES];

/**
 * Index names for queries
 */
export const INDEXES = {
  PROJECTS: {
    BY_STATUS: 'by_status',
    BY_UPDATED: 'by_updated_date'
  },
  TEST_RUNS: {
    BY_PROJECT: 'by_project_id',
    BY_STATUS: 'by_status',
    BY_STARTED: 'by_started_at'
  }
} as const;

// ============================================================================
// DATABASE CLASS
// ============================================================================

/**
 * IndexedDB database wrapper with typed operations
 * 
 * Uses singleton pattern - access via Database.getInstance()
 * 
 * @example
 * ```typescript
 * const db = await Database.getInstance();
 * 
 * // Create a project
 * const project = await db.addProject({
 *   name: 'My Test',
 *   target_url: 'https://example.com'
 * });
 * 
 * // Get all projects
 * const projects = await db.getAllProjects();
 * ```
 */
export class Database {
  private static instance: Database | null = null;
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get the singleton database instance
   * 
   * @returns Promise resolving to Database instance
   */
  static async getInstance(): Promise<Database> {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    
    await Database.instance.init();
    return Database.instance;
  }

  /**
   * Reset the singleton instance (for testing)
   */
  static resetInstance(): void {
    if (Database.instance?.db) {
      Database.instance.db.close();
    }
    Database.instance = null;
  }

  /**
   * Initialize the database connection
   */
  private async init(): Promise<void> {
    if (this.db) {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error(`Failed to open database: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        this.createSchema(db);
      };
    });

    return this.initPromise;
  }

  /**
   * Create database schema (object stores and indexes)
   */
  private createSchema(db: IDBDatabase): void {
    // Projects store
    if (!db.objectStoreNames.contains(STORES.PROJECTS)) {
      const projectStore = db.createObjectStore(STORES.PROJECTS, {
        keyPath: 'id',
        autoIncrement: true
      });
      
      projectStore.createIndex(INDEXES.PROJECTS.BY_STATUS, 'status', { unique: false });
      projectStore.createIndex(INDEXES.PROJECTS.BY_UPDATED, 'updated_date', { unique: false });
    }

    // Test Runs store
    if (!db.objectStoreNames.contains(STORES.TEST_RUNS)) {
      const testRunStore = db.createObjectStore(STORES.TEST_RUNS, {
        keyPath: 'id'
      });
      
      testRunStore.createIndex(INDEXES.TEST_RUNS.BY_PROJECT, 'project_id', { unique: false });
      testRunStore.createIndex(INDEXES.TEST_RUNS.BY_STATUS, 'status', { unique: false });
      testRunStore.createIndex(INDEXES.TEST_RUNS.BY_STARTED, 'started_at', { unique: false });
    }
  }

  /**
   * Get a transaction for the specified stores
   */
  private getTransaction(
    storeNames: StoreName | StoreName[],
    mode: IDBTransactionMode = 'readonly'
  ): IDBTransaction {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db.transaction(storeNames, mode);
  }

  /**
   * Get an object store from a transaction
   */
  private getStore(
    transaction: IDBTransaction,
    storeName: StoreName
  ): IDBObjectStore {
    return transaction.objectStore(storeName);
  }

  // ==========================================================================
  // PROJECT OPERATIONS
  // ==========================================================================

  /**
   * Add a new project
   * 
   * @param projectData - Project data (without id)
   * @returns Created project with assigned id
   */
  async addProject(projectData: Omit<Project, 'id'>): Promise<Project> {
    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction(STORES.PROJECTS, 'readwrite');
      const store = this.getStore(transaction, STORES.PROJECTS);

      const request = store.add(projectData);

      request.onsuccess = () => {
        const id = request.result as number;
        resolve({ ...projectData, id });
      };

      request.onerror = () => {
        reject(new Error(`Failed to add project: ${request.error?.message}`));
      };
    });
  }

  /**
   * Get a project by ID
   * 
   * @param id - Project ID
   * @returns Project or null if not found
   */
  async getProject(id: number): Promise<Project | null> {
    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction(STORES.PROJECTS);
      const store = this.getStore(transaction, STORES.PROJECTS);

      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(new Error(`Failed to get project: ${request.error?.message}`));
      };
    });
  }

  /**
   * Get all projects
   * 
   * @returns Array of all projects
   */
  async getAllProjects(): Promise<Project[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction(STORES.PROJECTS);
      const store = this.getStore(transaction, STORES.PROJECTS);

      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(new Error(`Failed to get projects: ${request.error?.message}`));
      };
    });
  }

  /**
   * Get projects by status
   * 
   * @param status - Project status to filter by
   * @returns Array of matching projects
   */
  async getProjectsByStatus(status: Project['status']): Promise<Project[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction(STORES.PROJECTS);
      const store = this.getStore(transaction, STORES.PROJECTS);
      const index = store.index(INDEXES.PROJECTS.BY_STATUS);

      const request = index.getAll(status);

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(new Error(`Failed to get projects by status: ${request.error?.message}`));
      };
    });
  }

  /**
   * Update a project
   * 
   * @param id - Project ID
   * @param updates - Fields to update
   * @returns Updated project
   */
  async updateProject(
    id: number,
    updates: Partial<Omit<Project, 'id' | 'created_date'>>
  ): Promise<Project> {
    const existing = await this.getProject(id);
    
    if (!existing) {
      throw new Error(`Project not found: ${id}`);
    }

    const updated: Project = {
      ...existing,
      ...updates,
      updated_date: Date.now()
    };

    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction(STORES.PROJECTS, 'readwrite');
      const store = this.getStore(transaction, STORES.PROJECTS);

      const request = store.put(updated);

      request.onsuccess = () => {
        resolve(updated);
      };

      request.onerror = () => {
        reject(new Error(`Failed to update project: ${request.error?.message}`));
      };
    });
  }

  /**
   * Delete a project
   * 
   * @param id - Project ID
   * @returns True if deleted
   */
  async deleteProject(id: number): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction(STORES.PROJECTS, 'readwrite');
      const store = this.getStore(transaction, STORES.PROJECTS);

      const request = store.delete(id);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        reject(new Error(`Failed to delete project: ${request.error?.message}`));
      };
    });
  }

  /**
   * Get project count
   * 
   * @returns Number of projects
   */
  async getProjectCount(): Promise<number> {
    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction(STORES.PROJECTS);
      const store = this.getStore(transaction, STORES.PROJECTS);

      const request = store.count();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(new Error(`Failed to count projects: ${request.error?.message}`));
      };
    });
  }

  // ==========================================================================
  // TEST RUN OPERATIONS
  // ==========================================================================

  /**
   * Add a new test run
   * 
   * @param testRun - Test run data
   * @returns Created test run
   */
  async addTestRun(testRun: TestRun): Promise<TestRun> {
    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction(STORES.TEST_RUNS, 'readwrite');
      const store = this.getStore(transaction, STORES.TEST_RUNS);

      const request = store.add(testRun);

      request.onsuccess = () => {
        resolve(testRun);
      };

      request.onerror = () => {
        reject(new Error(`Failed to add test run: ${request.error?.message}`));
      };
    });
  }

  /**
   * Get a test run by ID
   * 
   * @param id - Test run ID
   * @returns Test run or null if not found
   */
  async getTestRun(id: string): Promise<TestRun | null> {
    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction(STORES.TEST_RUNS);
      const store = this.getStore(transaction, STORES.TEST_RUNS);

      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(new Error(`Failed to get test run: ${request.error?.message}`));
      };
    });
  }

  /**
   * Get all test runs
   * 
   * @returns Array of all test runs
   */
  async getAllTestRuns(): Promise<TestRun[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction(STORES.TEST_RUNS);
      const store = this.getStore(transaction, STORES.TEST_RUNS);

      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(new Error(`Failed to get test runs: ${request.error?.message}`));
      };
    });
  }

  /**
   * Get test runs for a specific project
   * 
   * @param projectId - Project ID
   * @returns Array of test runs for the project
   */
  async getTestRunsByProject(projectId: number): Promise<TestRun[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction(STORES.TEST_RUNS);
      const store = this.getStore(transaction, STORES.TEST_RUNS);
      const index = store.index(INDEXES.TEST_RUNS.BY_PROJECT);

      const request = index.getAll(projectId);

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(new Error(`Failed to get test runs by project: ${request.error?.message}`));
      };
    });
  }

  /**
   * Get test runs by status
   * 
   * @param status - Test run status to filter by
   * @returns Array of matching test runs
   */
  async getTestRunsByStatus(status: TestRun['status']): Promise<TestRun[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction(STORES.TEST_RUNS);
      const store = this.getStore(transaction, STORES.TEST_RUNS);
      const index = store.index(INDEXES.TEST_RUNS.BY_STATUS);

      const request = index.getAll(status);

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(new Error(`Failed to get test runs by status: ${request.error?.message}`));
      };
    });
  }

  /**
   * Update a test run
   * 
   * @param id - Test run ID
   * @param updates - Fields to update
   * @returns Updated test run
   */
  async updateTestRun(
    id: string,
    updates: Partial<Omit<TestRun, 'id' | 'project_id'>>
  ): Promise<TestRun> {
    const existing = await this.getTestRun(id);
    
    if (!existing) {
      throw new Error(`Test run not found: ${id}`);
    }

    const updated: TestRun = {
      ...existing,
      ...updates
    };

    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction(STORES.TEST_RUNS, 'readwrite');
      const store = this.getStore(transaction, STORES.TEST_RUNS);

      const request = store.put(updated);

      request.onsuccess = () => {
        resolve(updated);
      };

      request.onerror = () => {
        reject(new Error(`Failed to update test run: ${request.error?.message}`));
      };
    });
  }

  /**
   * Delete a test run
   * 
   * @param id - Test run ID
   * @returns True if deleted
   */
  async deleteTestRun(id: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction(STORES.TEST_RUNS, 'readwrite');
      const store = this.getStore(transaction, STORES.TEST_RUNS);

      const request = store.delete(id);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        reject(new Error(`Failed to delete test run: ${request.error?.message}`));
      };
    });
  }

  /**
   * Delete all test runs for a project
   * 
   * @param projectId - Project ID
   * @returns Number of deleted test runs
   */
  async deleteTestRunsByProject(projectId: number): Promise<number> {
    const testRuns = await this.getTestRunsByProject(projectId);
    
    const deletePromises = testRuns.map(run => this.deleteTestRun(run.id));
    await Promise.all(deletePromises);
    
    return testRuns.length;
  }

  /**
   * Get test run count
   * 
   * @returns Number of test runs
   */
  async getTestRunCount(): Promise<number> {
    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction(STORES.TEST_RUNS);
      const store = this.getStore(transaction, STORES.TEST_RUNS);

      const request = store.count();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(new Error(`Failed to count test runs: ${request.error?.message}`));
      };
    });
  }

  // ==========================================================================
  // BULK OPERATIONS
  // ==========================================================================

  /**
   * Clear all data from the database
   * 
   * @returns True if cleared successfully
   */
  async clearAll(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction(
        [STORES.PROJECTS, STORES.TEST_RUNS],
        'readwrite'
      );

      const projectStore = this.getStore(transaction, STORES.PROJECTS);
      const testRunStore = this.getStore(transaction, STORES.TEST_RUNS);

      projectStore.clear();
      testRunStore.clear();

      transaction.oncomplete = () => {
        resolve(true);
      };

      transaction.onerror = () => {
        reject(new Error(`Failed to clear database: ${transaction.error?.message}`));
      };
    });
  }

  /**
   * Export all data from the database
   * 
   * @returns Object containing all projects and test runs
   */
  async exportAll(): Promise<{
    projects: Project[];
    testRuns: TestRun[];
    exportedAt: number;
  }> {
    const [projects, testRuns] = await Promise.all([
      this.getAllProjects(),
      this.getAllTestRuns()
    ]);

    return {
      projects,
      testRuns,
      exportedAt: Date.now()
    };
  }

  /**
   * Import data into the database
   * 
   * @param data - Data to import
   * @param overwrite - Whether to clear existing data first
   * @returns Import statistics
   */
  async importAll(
    data: { projects?: Project[]; testRuns?: TestRun[] },
    overwrite: boolean = false
  ): Promise<{ projectsImported: number; testRunsImported: number }> {
    if (overwrite) {
      await this.clearAll();
    }

    let projectsImported = 0;
    let testRunsImported = 0;

    if (data.projects) {
      for (const project of data.projects) {
        await this.addProject(project);
        projectsImported++;
      }
    }

    if (data.testRuns) {
      for (const testRun of data.testRuns) {
        await this.addTestRun(testRun);
        testRunsImported++;
      }
    }

    return { projectsImported, testRunsImported };
  }

  /**
   * Get storage statistics
   * 
   * @returns Storage stats
   */
  async getStats(): Promise<{
    projectCount: number;
    testRunCount: number;
    databaseName: string;
    databaseVersion: number;
  }> {
    const [projectCount, testRunCount] = await Promise.all([
      this.getProjectCount(),
      this.getTestRunCount()
    ]);

    return {
      projectCount,
      testRunCount,
      databaseName: DB_NAME,
      databaseVersion: DB_VERSION
    };
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initPromise = null;
    }
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Get the database instance (convenience function)
 * 
 * @returns Promise resolving to Database instance
 */
export async function getDatabase(): Promise<Database> {
  return Database.getInstance();
}

/**
 * Delete the entire database
 * 
 * @returns Promise resolving when deleted
 */
export function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    Database.resetInstance();
    
    const request = indexedDB.deleteDatabase(DB_NAME);
    
    request.onsuccess = () => {
      resolve();
    };
    
    request.onerror = () => {
      reject(new Error(`Failed to delete database: ${request.error?.message}`));
    };
  });
}

/**
 * Check if IndexedDB is available
 * 
 * @returns True if IndexedDB is supported
 */
export function isIndexedDBAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}
