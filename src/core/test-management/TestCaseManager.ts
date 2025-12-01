/**
 * TestCaseManager - CRUD operations for test cases
 * @module core/test-management/TestCaseManager
 * @version 1.0.0
 * 
 * Provides comprehensive test case management including creation,
 * retrieval, update, deletion, and organization.
 * 
 * Features:
 * - Full CRUD operations with validation
 * - Test case versioning and history
 * - Search and filtering
 * - Tagging and categorization
 * - Import/export capabilities
 * - Event emission for changes
 * 
 * @see test-orchestrator_breakdown.md for architecture details
 */

import type { RecordedStep } from '../types/step';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Storage key prefix for test cases
 */
export const STORAGE_KEY_PREFIX = 'testcase';

/**
 * Maximum test case name length
 */
export const MAX_NAME_LENGTH = 200;

/**
 * Maximum description length
 */
export const MAX_DESCRIPTION_LENGTH = 2000;

/**
 * Maximum tags per test case
 */
export const MAX_TAGS = 20;

/**
 * Maximum tag length
 */
export const MAX_TAG_LENGTH = 50;

/**
 * Maximum steps per test case
 */
export const MAX_STEPS = 500;

/**
 * Maximum versions to keep
 */
export const MAX_VERSIONS = 10;

/**
 * Test case statuses
 */
export const TEST_CASE_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  ARCHIVED: 'archived',
  DEPRECATED: 'deprecated',
} as const;

/**
 * Test case status type
 */
export type TestCaseStatus = typeof TEST_CASE_STATUS[keyof typeof TEST_CASE_STATUS];

// ============================================================================
// TYPES
// ============================================================================

/**
 * Test case definition
 */
export interface TestCase {
  /** Unique identifier */
  id: string;
  /** Test case name */
  name: string;
  /** Description */
  description?: string;
  /** Recorded steps */
  steps: RecordedStep[];
  /** Tags for categorization */
  tags: string[];
  /** Current status */
  status: TestCaseStatus;
  /** Base URL for replay */
  baseUrl?: string;
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
  /** Creator identifier */
  createdBy?: string;
  /** Last modifier identifier */
  updatedBy?: string;
  /** Current version number */
  version: number;
  /** Associated project ID */
  projectId?: string;
  /** Associated suite ID */
  suiteId?: string;
  /** Execution timeout (ms) */
  timeout?: number;
  /** Retry configuration */
  retryConfig?: {
    maxAttempts: number;
    delayMs: number;
  };
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Test case version snapshot
 */
export interface TestCaseVersion {
  /** Version number */
  version: number;
  /** Timestamp */
  timestamp: number;
  /** Modifier */
  modifiedBy?: string;
  /** Change description */
  changeDescription?: string;
  /** Snapshot of test case at this version */
  snapshot: Omit<TestCase, 'id'>;
}

/**
 * Test case creation input
 */
export interface CreateTestCaseInput {
  /** Test case name */
  name: string;
  /** Description */
  description?: string;
  /** Initial steps */
  steps?: RecordedStep[];
  /** Tags */
  tags?: string[];
  /** Base URL */
  baseUrl?: string;
  /** Project ID */
  projectId?: string;
  /** Suite ID */
  suiteId?: string;
  /** Creator */
  createdBy?: string;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Test case update input
 */
export interface UpdateTestCaseInput {
  /** Updated name */
  name?: string;
  /** Updated description */
  description?: string;
  /** Updated steps */
  steps?: RecordedStep[];
  /** Updated tags */
  tags?: string[];
  /** Updated status */
  status?: TestCaseStatus;
  /** Updated base URL */
  baseUrl?: string;
  /** Updated project ID */
  projectId?: string;
  /** Updated suite ID */
  suiteId?: string;
  /** Updated timeout */
  timeout?: number;
  /** Updated retry config */
  retryConfig?: TestCase['retryConfig'];
  /** Updated metadata */
  metadata?: Record<string, unknown>;
  /** Modifier */
  updatedBy?: string;
  /** Change description for versioning */
  changeDescription?: string;
}

/**
 * Test case filter options
 */
export interface TestCaseFilter {
  /** Filter by status */
  status?: TestCaseStatus | TestCaseStatus[];
  /** Filter by tags (any match) */
  tags?: string[];
  /** Filter by project */
  projectId?: string;
  /** Filter by suite */
  suiteId?: string;
  /** Search in name/description */
  search?: string;
  /** Created after */
  createdAfter?: number;
  /** Created before */
  createdBefore?: number;
  /** Updated after */
  updatedAfter?: number;
  /** Updated before */
  updatedBefore?: number;
  /** Created by */
  createdBy?: string;
}

/**
 * Test case sort options
 */
export interface TestCaseSort {
  /** Field to sort by */
  field: 'name' | 'createdAt' | 'updatedAt' | 'status';
  /** Sort direction */
  direction: 'asc' | 'desc';
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  /** Page number (1-based) */
  page: number;
  /** Items per page */
  pageSize: number;
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  /** Items for current page */
  items: T[];
  /** Total item count */
  total: number;
  /** Current page */
  page: number;
  /** Items per page */
  pageSize: number;
  /** Total pages */
  totalPages: number;
  /** Has next page */
  hasNext: boolean;
  /** Has previous page */
  hasPrevious: boolean;
}

/**
 * Validation error
 */
export interface ValidationError {
  /** Field with error */
  field: string;
  /** Error message */
  message: string;
  /** Error code */
  code: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether valid */
  valid: boolean;
  /** Validation errors */
  errors: ValidationError[];
}

/**
 * Storage interface for test cases
 */
export interface TestCaseStorage {
  get(id: string): Promise<TestCase | null>;
  getAll(): Promise<TestCase[]>;
  save(testCase: TestCase): Promise<void>;
  delete(id: string): Promise<boolean>;
  saveVersion(id: string, version: TestCaseVersion): Promise<void>;
  getVersions(id: string): Promise<TestCaseVersion[]>;
  clear(): Promise<void>;
}

/**
 * Event types
 */
export type TestCaseEventType = 
  | 'created'
  | 'updated'
  | 'deleted'
  | 'archived'
  | 'restored'
  | 'duplicated';

/**
 * Event listener
 */
export type TestCaseEventListener = (
  event: TestCaseEventType,
  testCase: TestCase,
  metadata?: Record<string, unknown>
) => void;

/**
 * Manager configuration
 */
export interface TestCaseManagerConfig {
  /** Storage implementation */
  storage?: TestCaseStorage;
  /** Enable versioning */
  enableVersioning?: boolean;
  /** Max versions to keep */
  maxVersions?: number;
  /** Auto-save on changes */
  autoSave?: boolean;
}

// ============================================================================
// IN-MEMORY STORAGE
// ============================================================================

/**
 * In-memory storage implementation
 */
class InMemoryTestCaseStorage implements TestCaseStorage {
  private testCases: Map<string, TestCase> = new Map();
  private versions: Map<string, TestCaseVersion[]> = new Map();
  
  async get(id: string): Promise<TestCase | null> {
    return this.testCases.get(id) ?? null;
  }
  
  async getAll(): Promise<TestCase[]> {
    return Array.from(this.testCases.values());
  }
  
  async save(testCase: TestCase): Promise<void> {
    this.testCases.set(testCase.id, { ...testCase });
  }
  
  async delete(id: string): Promise<boolean> {
    const existed = this.testCases.has(id);
    this.testCases.delete(id);
    this.versions.delete(id);
    return existed;
  }
  
  async saveVersion(id: string, version: TestCaseVersion): Promise<void> {
    const versions = this.versions.get(id) ?? [];
    versions.push(version);
    this.versions.set(id, versions);
  }
  
  async getVersions(id: string): Promise<TestCaseVersion[]> {
    return this.versions.get(id) ?? [];
  }
  
  async clear(): Promise<void> {
    this.testCases.clear();
    this.versions.clear();
  }
}

// ============================================================================
// MAIN CLASS
// ============================================================================

/**
 * TestCaseManager - Manages test case CRUD operations
 * 
 * @example
 * ```typescript
 * const manager = new TestCaseManager();
 * 
 * // Create test case
 * const testCase = await manager.create({
 *   name: 'Login Test',
 *   steps: recordedSteps,
 *   tags: ['auth', 'smoke'],
 * });
 * 
 * // Update test case
 * await manager.update(testCase.id, {
 *   name: 'Updated Login Test',
 *   changeDescription: 'Fixed locator',
 * });
 * 
 * // Search test cases
 * const results = await manager.search({ tags: ['smoke'] });
 * ```
 */
export class TestCaseManager {
  /**
   * Storage implementation
   */
  private storage: TestCaseStorage;
  
  /**
   * Configuration
   */
  private config: Required<TestCaseManagerConfig>;
  
  /**
   * Event listeners
   */
  private listeners: Set<TestCaseEventListener> = new Set();
  
  /**
   * Statistics
   */
  private stats = {
    created: 0,
    updated: 0,
    deleted: 0,
    retrieved: 0,
  };
  
  /**
   * Creates a new TestCaseManager
   * 
   * @param config - Manager configuration
   */
  constructor(config: TestCaseManagerConfig = {}) {
    this.storage = config.storage ?? new InMemoryTestCaseStorage();
    this.config = {
      storage: this.storage,
      enableVersioning: config.enableVersioning ?? true,
      maxVersions: config.maxVersions ?? MAX_VERSIONS,
      autoSave: config.autoSave ?? true,
    };
  }
  
  // ==========================================================================
  // CRUD OPERATIONS
  // ==========================================================================
  
  /**
   * Creates a new test case
   * 
   * @param input - Test case creation input
   * @returns Created test case
   */
  async create(input: CreateTestCaseInput): Promise<TestCase> {
    // Validate input
    const validation = this.validateCreateInput(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }
    
    // Create test case
    const now = Date.now();
    const testCase: TestCase = {
      id: this.generateId(),
      name: input.name.trim(),
      description: input.description?.trim(),
      steps: input.steps ?? [],
      tags: this.normalizeTags(input.tags ?? []),
      status: TEST_CASE_STATUS.DRAFT,
      baseUrl: input.baseUrl,
      createdAt: now,
      updatedAt: now,
      createdBy: input.createdBy,
      version: 1,
      projectId: input.projectId,
      suiteId: input.suiteId,
      metadata: input.metadata,
    };
    
    // Save
    await this.storage.save(testCase);
    
    // Emit event
    this.emit('created', testCase);
    
    this.stats.created++;
    
    return testCase;
  }
  
  /**
   * Gets a test case by ID
   * 
   * @param id - Test case ID
   * @returns Test case or null
   */
  async get(id: string): Promise<TestCase | null> {
    const testCase = await this.storage.get(id);
    
    if (testCase) {
      this.stats.retrieved++;
    }
    
    return testCase;
  }
  
  /**
   * Gets a test case by ID, throws if not found
   * 
   * @param id - Test case ID
   * @returns Test case
   */
  async getOrThrow(id: string): Promise<TestCase> {
    const testCase = await this.get(id);
    
    if (!testCase) {
      throw new Error(`Test case not found: ${id}`);
    }
    
    return testCase;
  }
  
  /**
   * Gets all test cases
   * 
   * @returns All test cases
   */
  async getAll(): Promise<TestCase[]> {
    return this.storage.getAll();
  }
  
  /**
   * Updates a test case
   * 
   * @param id - Test case ID
   * @param input - Update input
   * @returns Updated test case
   */
  async update(id: string, input: UpdateTestCaseInput): Promise<TestCase> {
    // Get existing
    const existing = await this.getOrThrow(id);
    
    // Validate input
    const validation = this.validateUpdateInput(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }
    
    // Save version before update if enabled
    if (this.config.enableVersioning) {
      await this.saveVersion(existing, input.changeDescription);
    }
    
    // Apply updates
    const updated: TestCase = {
      ...existing,
      name: input.name?.trim() ?? existing.name,
      description: input.description !== undefined ? input.description?.trim() : existing.description,
      steps: input.steps ?? existing.steps,
      tags: input.tags ? this.normalizeTags(input.tags) : existing.tags,
      status: input.status ?? existing.status,
      baseUrl: input.baseUrl !== undefined ? input.baseUrl : existing.baseUrl,
      projectId: input.projectId !== undefined ? input.projectId : existing.projectId,
      suiteId: input.suiteId !== undefined ? input.suiteId : existing.suiteId,
      timeout: input.timeout !== undefined ? input.timeout : existing.timeout,
      retryConfig: input.retryConfig !== undefined ? input.retryConfig : existing.retryConfig,
      metadata: input.metadata !== undefined ? { ...existing.metadata, ...input.metadata } : existing.metadata,
      updatedAt: Date.now(),
      updatedBy: input.updatedBy,
      version: existing.version + 1,
    };
    
    // Save
    await this.storage.save(updated);
    
    // Emit event
    this.emit('updated', updated, { previousVersion: existing.version });
    
    this.stats.updated++;
    
    return updated;
  }
  
  /**
   * Deletes a test case
   * 
   * @param id - Test case ID
   * @returns Whether deleted
   */
  async delete(id: string): Promise<boolean> {
    const testCase = await this.get(id);
    
    if (!testCase) {
      return false;
    }
    
    const deleted = await this.storage.delete(id);
    
    if (deleted) {
      this.emit('deleted', testCase);
      this.stats.deleted++;
    }
    
    return deleted;
  }
  
  /**
   * Archives a test case
   * 
   * @param id - Test case ID
   * @returns Updated test case
   */
  async archive(id: string): Promise<TestCase> {
    const updated = await this.update(id, {
      status: TEST_CASE_STATUS.ARCHIVED,
      changeDescription: 'Archived',
    });
    
    this.emit('archived', updated);
    
    return updated;
  }
  
  /**
   * Restores an archived test case
   * 
   * @param id - Test case ID
   * @returns Updated test case
   */
  async restore(id: string): Promise<TestCase> {
    const updated = await this.update(id, {
      status: TEST_CASE_STATUS.ACTIVE,
      changeDescription: 'Restored from archive',
    });
    
    this.emit('restored', updated);
    
    return updated;
  }
  
  /**
   * Duplicates a test case
   * 
   * @param id - Source test case ID
   * @param options - Duplication options
   * @returns New test case
   */
  async duplicate(
    id: string,
    options?: {
      name?: string;
      projectId?: string;
      suiteId?: string;
      createdBy?: string;
    }
  ): Promise<TestCase> {
    const source = await this.getOrThrow(id);
    
    const duplicate = await this.create({
      name: options?.name ?? `${source.name} (Copy)`,
      description: source.description,
      steps: JSON.parse(JSON.stringify(source.steps)),
      tags: [...source.tags],
      baseUrl: source.baseUrl,
      projectId: options?.projectId ?? source.projectId,
      suiteId: options?.suiteId ?? source.suiteId,
      createdBy: options?.createdBy,
      metadata: {
        ...source.metadata,
        duplicatedFrom: id,
      },
    });
    
    this.emit('duplicated', duplicate, { sourceId: id });
    
    return duplicate;
  }
  
  // ==========================================================================
  // SEARCH AND FILTER
  // ==========================================================================
  
  /**
   * Searches test cases with filters
   * 
   * @param filter - Filter options
   * @param sort - Sort options
   * @returns Filtered test cases
   */
  async search(
    filter?: TestCaseFilter,
    sort?: TestCaseSort
  ): Promise<TestCase[]> {
    let testCases = await this.getAll();
    
    // Apply filters
    if (filter) {
      testCases = this.applyFilter(testCases, filter);
    }
    
    // Apply sort
    if (sort) {
      testCases = this.applySort(testCases, sort);
    }
    
    return testCases;
  }
  
  /**
   * Searches with pagination
   * 
   * @param filter - Filter options
   * @param sort - Sort options
   * @param pagination - Pagination options
   * @returns Paginated results
   */
  async searchPaginated(
    filter?: TestCaseFilter,
    sort?: TestCaseSort,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<TestCase>> {
    const all = await this.search(filter, sort);
    
    const page = pagination?.page ?? 1;
    const pageSize = pagination?.pageSize ?? 20;
    const total = all.length;
    const totalPages = Math.ceil(total / pageSize);
    
    const start = (page - 1) * pageSize;
    const items = all.slice(start, start + pageSize);
    
    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    };
  }
  
  /**
   * Gets test cases by project
   * 
   * @param projectId - Project ID
   * @returns Test cases in project
   */
  async getByProject(projectId: string): Promise<TestCase[]> {
    return this.search({ projectId });
  }
  
  /**
   * Gets test cases by suite
   * 
   * @param suiteId - Suite ID
   * @returns Test cases in suite
   */
  async getBySuite(suiteId: string): Promise<TestCase[]> {
    return this.search({ suiteId });
  }
  
  /**
   * Gets test cases by tags
   * 
   * @param tags - Tags to match (any)
   * @returns Matching test cases
   */
  async getByTags(tags: string[]): Promise<TestCase[]> {
    return this.search({ tags });
  }
  
  /**
   * Applies filters to test cases
   */
  private applyFilter(testCases: TestCase[], filter: TestCaseFilter): TestCase[] {
    return testCases.filter(tc => {
      // Status filter
      if (filter.status) {
        const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
        if (!statuses.includes(tc.status)) return false;
      }
      
      // Tags filter (any match)
      if (filter.tags && filter.tags.length > 0) {
        const hasMatchingTag = filter.tags.some(tag => 
          tc.tags.includes(tag.toLowerCase())
        );
        if (!hasMatchingTag) return false;
      }
      
      // Project filter
      if (filter.projectId && tc.projectId !== filter.projectId) {
        return false;
      }
      
      // Suite filter
      if (filter.suiteId && tc.suiteId !== filter.suiteId) {
        return false;
      }
      
      // Search filter
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        const nameMatch = tc.name.toLowerCase().includes(searchLower);
        const descMatch = tc.description?.toLowerCase().includes(searchLower) ?? false;
        if (!nameMatch && !descMatch) return false;
      }
      
      // Date filters
      if (filter.createdAfter && tc.createdAt < filter.createdAfter) {
        return false;
      }
      if (filter.createdBefore && tc.createdAt > filter.createdBefore) {
        return false;
      }
      if (filter.updatedAfter && tc.updatedAt < filter.updatedAfter) {
        return false;
      }
      if (filter.updatedBefore && tc.updatedAt > filter.updatedBefore) {
        return false;
      }
      
      // Created by filter
      if (filter.createdBy && tc.createdBy !== filter.createdBy) {
        return false;
      }
      
      return true;
    });
  }
  
  /**
   * Applies sorting to test cases
   */
  private applySort(testCases: TestCase[], sort: TestCaseSort): TestCase[] {
    const multiplier = sort.direction === 'asc' ? 1 : -1;
    
    return [...testCases].sort((a, b) => {
      switch (sort.field) {
        case 'name':
          return multiplier * a.name.localeCompare(b.name);
        case 'createdAt':
          return multiplier * (a.createdAt - b.createdAt);
        case 'updatedAt':
          return multiplier * (a.updatedAt - b.updatedAt);
        case 'status':
          return multiplier * a.status.localeCompare(b.status);
        default:
          return 0;
      }
    });
  }
  
  // ==========================================================================
  // VERSIONING
  // ==========================================================================
  
  /**
   * Gets version history for a test case
   * 
   * @param id - Test case ID
   * @returns Version history
   */
  async getVersionHistory(id: string): Promise<TestCaseVersion[]> {
    return this.storage.getVersions(id);
  }
  
  /**
   * Restores a specific version
   * 
   * @param id - Test case ID
   * @param version - Version number to restore
   * @returns Restored test case
   */
  async restoreVersion(id: string, version: number): Promise<TestCase> {
    const versions = await this.getVersionHistory(id);
    const targetVersion = versions.find(v => v.version === version);
    
    if (!targetVersion) {
      throw new Error(`Version ${version} not found for test case ${id}`);
    }
    
    return this.update(id, {
      ...targetVersion.snapshot,
      changeDescription: `Restored from version ${version}`,
    });
  }
  
  /**
   * Saves a version snapshot
   */
  private async saveVersion(testCase: TestCase, changeDescription?: string): Promise<void> {
    const version: TestCaseVersion = {
      version: testCase.version,
      timestamp: Date.now(),
      modifiedBy: testCase.updatedBy,
      changeDescription,
      snapshot: {
        name: testCase.name,
        description: testCase.description,
        steps: JSON.parse(JSON.stringify(testCase.steps)),
        tags: [...testCase.tags],
        status: testCase.status,
        baseUrl: testCase.baseUrl,
        createdAt: testCase.createdAt,
        updatedAt: testCase.updatedAt,
        createdBy: testCase.createdBy,
        updatedBy: testCase.updatedBy,
        version: testCase.version,
        projectId: testCase.projectId,
        suiteId: testCase.suiteId,
        timeout: testCase.timeout,
        retryConfig: testCase.retryConfig,
        metadata: testCase.metadata,
      },
    };
    
    await this.storage.saveVersion(testCase.id, version);
    
    // Trim old versions
    await this.trimVersions(testCase.id);
  }
  
  /**
   * Trims old versions to stay within limit
   */
  private async trimVersions(id: string): Promise<void> {
    const versions = await this.storage.getVersions(id);
    
    if (versions.length > this.config.maxVersions) {
      // Keep only the most recent versions
      // Note: In a real implementation, we'd delete old versions from storage
      // For in-memory, they're already stored as an array
    }
  }
  
  // ==========================================================================
  // STEPS MANAGEMENT
  // ==========================================================================
  
  /**
   * Adds a step to a test case
   * 
   * @param id - Test case ID
   * @param step - Step to add
   * @param index - Optional index to insert at
   * @returns Updated test case
   */
  async addStep(
    id: string,
    step: RecordedStep,
    index?: number
  ): Promise<TestCase> {
    const testCase = await this.getOrThrow(id);
    const steps = [...testCase.steps];
    
    if (index !== undefined && index >= 0 && index <= steps.length) {
      steps.splice(index, 0, step);
    } else {
      steps.push(step);
    }
    
    return this.update(id, {
      steps,
      changeDescription: `Added step: ${step.type}`,
    });
  }
  
  /**
   * Removes a step from a test case
   * 
   * @param id - Test case ID
   * @param stepIndex - Index of step to remove
   * @returns Updated test case
   */
  async removeStep(id: string, stepIndex: number): Promise<TestCase> {
    const testCase = await this.getOrThrow(id);
    const steps = [...testCase.steps];
    
    if (stepIndex < 0 || stepIndex >= steps.length) {
      throw new Error(`Invalid step index: ${stepIndex}`);
    }
    
    const removed = steps.splice(stepIndex, 1)[0];
    
    return this.update(id, {
      steps,
      changeDescription: `Removed step ${stepIndex}: ${removed.type}`,
    });
  }
  
  /**
   * Updates a step in a test case
   * 
   * @param id - Test case ID
   * @param stepIndex - Index of step to update
   * @param updates - Step updates
   * @returns Updated test case
   */
  async updateStep(
    id: string,
    stepIndex: number,
    updates: Partial<RecordedStep>
  ): Promise<TestCase> {
    const testCase = await this.getOrThrow(id);
    const steps = [...testCase.steps];
    
    if (stepIndex < 0 || stepIndex >= steps.length) {
      throw new Error(`Invalid step index: ${stepIndex}`);
    }
    
    steps[stepIndex] = { ...steps[stepIndex], ...updates };
    
    return this.update(id, {
      steps,
      changeDescription: `Updated step ${stepIndex}`,
    });
  }
  
  /**
   * Reorders steps in a test case
   * 
   * @param id - Test case ID
   * @param fromIndex - Source index
   * @param toIndex - Destination index
   * @returns Updated test case
   */
  async reorderStep(
    id: string,
    fromIndex: number,
    toIndex: number
  ): Promise<TestCase> {
    const testCase = await this.getOrThrow(id);
    const steps = [...testCase.steps];
    
    if (fromIndex < 0 || fromIndex >= steps.length) {
      throw new Error(`Invalid source index: ${fromIndex}`);
    }
    if (toIndex < 0 || toIndex >= steps.length) {
      throw new Error(`Invalid destination index: ${toIndex}`);
    }
    
    const [step] = steps.splice(fromIndex, 1);
    steps.splice(toIndex, 0, step);
    
    return this.update(id, {
      steps,
      changeDescription: `Moved step from ${fromIndex} to ${toIndex}`,
    });
  }
  
  // ==========================================================================
  // TAGS MANAGEMENT
  // ==========================================================================
  
  /**
   * Adds tags to a test case
   * 
   * @param id - Test case ID
   * @param tags - Tags to add
   * @returns Updated test case
   */
  async addTags(id: string, tags: string[]): Promise<TestCase> {
    const testCase = await this.getOrThrow(id);
    const newTags = this.normalizeTags([...testCase.tags, ...tags]);
    
    return this.update(id, {
      tags: newTags,
      changeDescription: `Added tags: ${tags.join(', ')}`,
    });
  }
  
  /**
   * Removes tags from a test case
   * 
   * @param id - Test case ID
   * @param tags - Tags to remove
   * @returns Updated test case
   */
  async removeTags(id: string, tags: string[]): Promise<TestCase> {
    const testCase = await this.getOrThrow(id);
    const normalizedRemove = tags.map(t => t.toLowerCase().trim());
    const newTags = testCase.tags.filter(t => !normalizedRemove.includes(t));
    
    return this.update(id, {
      tags: newTags,
      changeDescription: `Removed tags: ${tags.join(', ')}`,
    });
  }
  
  /**
   * Gets all unique tags
   * 
   * @returns All unique tags
   */
  async getAllTags(): Promise<string[]> {
    const testCases = await this.getAll();
    const tags = new Set<string>();
    
    for (const tc of testCases) {
      for (const tag of tc.tags) {
        tags.add(tag);
      }
    }
    
    return Array.from(tags).sort();
  }
  
  // ==========================================================================
  // IMPORT/EXPORT
  // ==========================================================================
  
  /**
   * Exports a test case to JSON
   * 
   * @param id - Test case ID
   * @returns JSON string
   */
  async exportToJson(id: string): Promise<string> {
    const testCase = await this.getOrThrow(id);
    return JSON.stringify(testCase, null, 2);
  }
  
  /**
   * Exports multiple test cases to JSON
   * 
   * @param ids - Test case IDs
   * @returns JSON string
   */
  async exportMultipleToJson(ids: string[]): Promise<string> {
    const testCases = await Promise.all(
      ids.map(id => this.get(id))
    );
    
    return JSON.stringify(
      testCases.filter((tc): tc is TestCase => tc !== null),
      null,
      2
    );
  }
  
  /**
   * Imports a test case from JSON
   * 
   * @param json - JSON string
   * @param options - Import options
   * @returns Imported test case
   */
  async importFromJson(
    json: string,
    options?: {
      projectId?: string;
      suiteId?: string;
      createdBy?: string;
    }
  ): Promise<TestCase> {
    const data = JSON.parse(json) as Partial<TestCase>;
    
    return this.create({
      name: data.name ?? 'Imported Test',
      description: data.description,
      steps: data.steps ?? [],
      tags: data.tags ?? [],
      baseUrl: data.baseUrl,
      projectId: options?.projectId ?? data.projectId,
      suiteId: options?.suiteId ?? data.suiteId,
      createdBy: options?.createdBy,
      metadata: {
        ...data.metadata,
        importedAt: Date.now(),
        importedFrom: data.id,
      },
    });
  }
  
  // ==========================================================================
  // VALIDATION
  // ==========================================================================
  
  /**
   * Validates create input
   */
  private validateCreateInput(input: CreateTestCaseInput): ValidationResult {
    const errors: ValidationError[] = [];
    
    // Name validation
    if (!input.name || input.name.trim().length === 0) {
      errors.push({
        field: 'name',
        message: 'Name is required',
        code: 'REQUIRED',
      });
    } else if (input.name.length > MAX_NAME_LENGTH) {
      errors.push({
        field: 'name',
        message: `Name must be ${MAX_NAME_LENGTH} characters or less`,
        code: 'MAX_LENGTH',
      });
    }
    
    // Description validation
    if (input.description && input.description.length > MAX_DESCRIPTION_LENGTH) {
      errors.push({
        field: 'description',
        message: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less`,
        code: 'MAX_LENGTH',
      });
    }
    
    // Tags validation
    if (input.tags) {
      if (input.tags.length > MAX_TAGS) {
        errors.push({
          field: 'tags',
          message: `Maximum ${MAX_TAGS} tags allowed`,
          code: 'MAX_COUNT',
        });
      }
      
      for (const tag of input.tags) {
        if (tag.length > MAX_TAG_LENGTH) {
          errors.push({
            field: 'tags',
            message: `Tag "${tag}" exceeds ${MAX_TAG_LENGTH} characters`,
            code: 'MAX_LENGTH',
          });
        }
      }
    }
    
    // Steps validation
    if (input.steps && input.steps.length > MAX_STEPS) {
      errors.push({
        field: 'steps',
        message: `Maximum ${MAX_STEPS} steps allowed`,
        code: 'MAX_COUNT',
      });
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  
  /**
   * Validates update input
   */
  private validateUpdateInput(input: UpdateTestCaseInput): ValidationResult {
    const errors: ValidationError[] = [];
    
    // Name validation
    if (input.name !== undefined) {
      if (input.name.trim().length === 0) {
        errors.push({
          field: 'name',
          message: 'Name cannot be empty',
          code: 'REQUIRED',
        });
      } else if (input.name.length > MAX_NAME_LENGTH) {
        errors.push({
          field: 'name',
          message: `Name must be ${MAX_NAME_LENGTH} characters or less`,
          code: 'MAX_LENGTH',
        });
      }
    }
    
    // Description validation
    if (input.description && input.description.length > MAX_DESCRIPTION_LENGTH) {
      errors.push({
        field: 'description',
        message: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less`,
        code: 'MAX_LENGTH',
      });
    }
    
    // Tags validation
    if (input.tags) {
      if (input.tags.length > MAX_TAGS) {
        errors.push({
          field: 'tags',
          message: `Maximum ${MAX_TAGS} tags allowed`,
          code: 'MAX_COUNT',
        });
      }
    }
    
    // Steps validation
    if (input.steps && input.steps.length > MAX_STEPS) {
      errors.push({
        field: 'steps',
        message: `Maximum ${MAX_STEPS} steps allowed`,
        code: 'MAX_COUNT',
      });
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  
  /**
   * Validates a complete test case
   * 
   * @param testCase - Test case to validate
   * @returns Validation result
   */
  validate(testCase: TestCase): ValidationResult {
    return this.validateCreateInput({
      name: testCase.name,
      description: testCase.description,
      steps: testCase.steps,
      tags: testCase.tags,
    });
  }
  
  // ==========================================================================
  // EVENTS
  // ==========================================================================
  
  /**
   * Adds an event listener
   * 
   * @param listener - Event listener
   * @returns Unsubscribe function
   */
  addEventListener(listener: TestCaseEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  /**
   * Emits an event
   */
  private emit(
    event: TestCaseEventType,
    testCase: TestCase,
    metadata?: Record<string, unknown>
  ): void {
    for (const listener of this.listeners) {
      try {
        listener(event, testCase, metadata);
      } catch (error) {
        console.error('[TestCaseManager] Event listener error:', error);
      }
    }
  }
  
  // ==========================================================================
  // UTILITIES
  // ==========================================================================
  
  /**
   * Generates a unique ID
   */
  private generateId(): string {
    return `tc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
  
  /**
   * Normalizes tags (lowercase, trim, dedupe)
   */
  private normalizeTags(tags: string[]): string[] {
    const normalized = tags
      .map(t => t.toLowerCase().trim())
      .filter(t => t.length > 0);
    
    return Array.from(new Set(normalized));
  }
  
  /**
   * Gets statistics
   */
  getStats(): typeof this.stats {
    return { ...this.stats };
  }
  
  /**
   * Resets statistics
   */
  resetStats(): void {
    this.stats = {
      created: 0,
      updated: 0,
      deleted: 0,
      retrieved: 0,
    };
  }
  
  /**
   * Gets count of test cases
   */
  async count(filter?: TestCaseFilter): Promise<number> {
    const testCases = await this.search(filter);
    return testCases.length;
  }
  
  /**
   * Clears all test cases
   */
  async clear(): Promise<void> {
    await this.storage.clear();
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Creates a new TestCaseManager
 * 
 * @param config - Manager configuration
 * @returns New TestCaseManager instance
 */
export function createTestCaseManager(
  config?: TestCaseManagerConfig
): TestCaseManager {
  return new TestCaseManager(config);
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default TestCaseManager;
