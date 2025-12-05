/**
 * Storage Provider Integration Tests
 * @module tests/integration/storage/storage-provider.test
 * @version 1.0.0
 * 
 * Integration tests for the storage provider abstraction.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';

import { 
  DexieStorageProvider, 
  InMemoryStorageProvider,
  createStorageProvider,
  db 
} from '@/core/storage';

// ============================================================================
// DEXIE PROVIDER TESTS
// ============================================================================

describe('DexieStorageProvider', () => {
  let provider: DexieStorageProvider;

  beforeEach(async () => {
    await db.projects.clear();
    await db.testRuns.clear();
    provider = new DexieStorageProvider(db);
  });

  afterEach(async () => {
    await db.projects.clear();
    await db.testRuns.clear();
  });

  describe('projects', () => {
    it('should provide project repository', () => {
      expect(provider.projects).toBeDefined();
      expect(provider.projects.create).toBeTypeOf('function');
      expect(provider.projects.getById).toBeTypeOf('function');
      expect(provider.projects.getAll).toBeTypeOf('function');
      expect(provider.projects.update).toBeTypeOf('function');
      expect(provider.projects.delete).toBeTypeOf('function');
    });

    it('should persist projects', async () => {
      const id = await provider.projects.create({ name: 'Provider Test' });
      const project = await provider.projects.getById(id);

      expect(project?.name).toBe('Provider Test');
    });
  });

  describe('testRuns', () => {
    it('should provide testRun repository', () => {
      expect(provider.testRuns).toBeDefined();
      expect(provider.testRuns.create).toBeTypeOf('function');
      expect(provider.testRuns.getById).toBeTypeOf('function');
      expect(provider.testRuns.getByProjectId).toBeTypeOf('function');
      expect(provider.testRuns.update).toBeTypeOf('function');
      expect(provider.testRuns.delete).toBeTypeOf('function');
    });

    it('should persist test runs', async () => {
      const projectId = await provider.projects.create({ name: 'Project' });
      const runId = await provider.testRuns.create({
        project_id: projectId,
        total_steps: 5,
      });

      const testRun = await provider.testRuns.getById(runId);
      expect(testRun?.project_id).toBe(projectId);
    });
  });
});

// ============================================================================
// IN-MEMORY PROVIDER TESTS
// ============================================================================

describe('InMemoryStorageProvider', () => {
  let provider: InMemoryStorageProvider;

  beforeEach(() => {
    provider = new InMemoryStorageProvider();
  });

  describe('projects', () => {
    it('should create and retrieve projects', async () => {
      const id = await provider.projects.create({
        name: 'In-Memory Project',
        description: 'Test',
        target_url: 'https://test.com',
      });

      const project = await provider.projects.getById(id);
      expect(project?.name).toBe('In-Memory Project');
    });

    it('should list all projects', async () => {
      await provider.projects.create({ name: 'Project 1' });
      await provider.projects.create({ name: 'Project 2' });
      await provider.projects.create({ name: 'Project 3' });

      const projects = await provider.projects.getAll();
      expect(projects).toHaveLength(3);
    });

    it('should update projects', async () => {
      const id = await provider.projects.create({ name: 'Original' });
      await provider.projects.update(id, { name: 'Updated' });

      const project = await provider.projects.getById(id);
      expect(project?.name).toBe('Updated');
    });

    it('should delete projects', async () => {
      const id = await provider.projects.create({ name: 'To Delete' });
      await provider.projects.delete(id);

      const project = await provider.projects.getById(id);
      expect(project).toBeUndefined();
    });
  });

  describe('testRuns', () => {
    it('should create and retrieve test runs', async () => {
      const projectId = await provider.projects.create({ name: 'Project' });
      const runId = await provider.testRuns.create({
        project_id: projectId,
        total_steps: 10,
      });

      const testRun = await provider.testRuns.getById(runId);
      expect(testRun?.total_steps).toBe(10);
    });

    it('should filter by project ID', async () => {
      const projectId1 = await provider.projects.create({ name: 'Project 1' });
      const projectId2 = await provider.projects.create({ name: 'Project 2' });

      await provider.testRuns.create({ project_id: projectId1, total_steps: 3 });
      await provider.testRuns.create({ project_id: projectId1, total_steps: 5 });
      await provider.testRuns.create({ project_id: projectId2, total_steps: 2 });

      const runs = await provider.testRuns.getByProjectId(projectId1);
      expect(runs).toHaveLength(2);
    });
  });

  describe('isolation', () => {
    it('should be isolated between instances', async () => {
      const provider1 = new InMemoryStorageProvider();
      const provider2 = new InMemoryStorageProvider();

      await provider1.projects.create({ name: 'Provider 1 Project' });
      await provider2.projects.create({ name: 'Provider 2 Project' });

      const projects1 = await provider1.projects.getAll();
      const projects2 = await provider2.projects.getAll();

      expect(projects1).toHaveLength(1);
      expect(projects2).toHaveLength(1);
      expect(projects1[0].name).toBe('Provider 1 Project');
      expect(projects2[0].name).toBe('Provider 2 Project');
    });
  });
});

// ============================================================================
// FACTORY TESTS
// ============================================================================

describe('createStorageProvider', () => {
  it('should create Dexie provider by default', async () => {
    const provider = createStorageProvider();
    expect(provider).toBeInstanceOf(DexieStorageProvider);
  });

  it('should create in-memory provider when specified', () => {
    const provider = createStorageProvider({ type: 'memory' });
    expect(provider).toBeInstanceOf(InMemoryStorageProvider);
  });

  it('should create Dexie provider when specified', () => {
    const provider = createStorageProvider({ type: 'dexie' });
    expect(provider).toBeInstanceOf(DexieStorageProvider);
  });
});
