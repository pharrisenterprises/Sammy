/**
 * TestCaseManager Test Suite
 * @module core/test-management/TestCaseManager.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  TestCaseManager,
  createTestCaseManager,
  TEST_CASE_STATUS,
  MAX_NAME_LENGTH,
  MAX_TAGS,
  type CreateTestCaseInput,
} from './TestCaseManager';
import type { RecordedStep } from '../types/step';

// ============================================================================
// MOCK DATA
// ============================================================================

function createMockStep(overrides: Partial<RecordedStep> = {}): RecordedStep {
  return {
    id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name: 'Click button',
    event: 'click',
    path: '/html/body/button',
    value: '',
    label: 'Submit',
    x: 100,
    y: 200,
    type: 'click',
    timestamp: Date.now(),
    target: {
      tagName: 'button',
      xpath: '/html/body/button',
      cssSelector: 'button',
    },
    ...overrides,
  };
}

function createMockInput(overrides: Partial<CreateTestCaseInput> = {}): CreateTestCaseInput {
  return {
    name: 'Test Case',
    description: 'Test description',
    steps: [createMockStep()],
    tags: ['smoke', 'auth'],
    ...overrides,
  };
}

// ============================================================================
// CRUD TESTS
// ============================================================================

describe('TestCaseManager CRUD', () => {
  let manager: TestCaseManager;
  
  beforeEach(() => {
    manager = createTestCaseManager();
  });
  
  afterEach(async () => {
    await manager.clear();
  });
  
  describe('create()', () => {
    it('should create a test case', async () => {
      const input = createMockInput({ name: 'Login Test' });
      const testCase = await manager.create(input);
      
      expect(testCase.id).toBeDefined();
      expect(testCase.name).toBe('Login Test');
      expect(testCase.status).toBe(TEST_CASE_STATUS.DRAFT);
      expect(testCase.version).toBe(1);
    });
    
    it('should trim name and description', async () => {
      const testCase = await manager.create({
        name: '  Spaced Name  ',
        description: '  Spaced Description  ',
      });
      
      expect(testCase.name).toBe('Spaced Name');
      expect(testCase.description).toBe('Spaced Description');
    });
    
    it('should normalize tags', async () => {
      const testCase = await manager.create({
        name: 'Test',
        tags: ['TAG1', '  tag2  ', 'tag1'],
      });
      
      expect(testCase.tags).toEqual(['tag1', 'tag2']);
    });
    
    it('should throw on empty name', async () => {
      await expect(manager.create({ name: '' }))
        .rejects.toThrow(/Name is required/);
    });
    
    it('should throw on name too long', async () => {
      await expect(manager.create({ name: 'a'.repeat(MAX_NAME_LENGTH + 1) }))
        .rejects.toThrow(/characters or less/);
    });
    
    it('should throw on too many tags', async () => {
      const tags = Array.from({ length: MAX_TAGS + 1 }, (_, i) => `tag${i}`);
      
      await expect(manager.create({ name: 'Test', tags }))
        .rejects.toThrow(/Maximum.*tags/);
    });
  });
  
  describe('get()', () => {
    it('should get a test case by ID', async () => {
      const created = await manager.create(createMockInput());
      const retrieved = await manager.get(created.id);
      
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
    });
    
    it('should return null for non-existent ID', async () => {
      const retrieved = await manager.get('non-existent');
      
      expect(retrieved).toBeNull();
    });
  });
  
  describe('getOrThrow()', () => {
    it('should throw for non-existent ID', async () => {
      await expect(manager.getOrThrow('non-existent'))
        .rejects.toThrow(/not found/);
    });
  });
  
  describe('getAll()', () => {
    it('should get all test cases', async () => {
      await manager.create(createMockInput({ name: 'Test 1' }));
      await manager.create(createMockInput({ name: 'Test 2' }));
      
      const all = await manager.getAll();
      
      expect(all).toHaveLength(2);
    });
  });
  
  describe('update()', () => {
    it('should update a test case', async () => {
      const created = await manager.create(createMockInput());
      
      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const updated = await manager.update(created.id, {
        name: 'Updated Name',
      });
      
      expect(updated.name).toBe('Updated Name');
      expect(updated.version).toBe(2);
      expect(updated.updatedAt).toBeGreaterThan(created.updatedAt);
    });
    
    it('should merge metadata', async () => {
      const created = await manager.create(createMockInput({
        metadata: { key1: 'value1' },
      }));
      
      const updated = await manager.update(created.id, {
        metadata: { key2: 'value2' },
      });
      
      expect(updated.metadata).toEqual({
        key1: 'value1',
        key2: 'value2',
      });
    });
    
    it('should throw for non-existent ID', async () => {
      await expect(manager.update('non-existent', { name: 'Test' }))
        .rejects.toThrow(/not found/);
    });
  });
  
  describe('delete()', () => {
    it('should delete a test case', async () => {
      const created = await manager.create(createMockInput());
      const deleted = await manager.delete(created.id);
      
      expect(deleted).toBe(true);
      expect(await manager.get(created.id)).toBeNull();
    });
    
    it('should return false for non-existent ID', async () => {
      const deleted = await manager.delete('non-existent');
      
      expect(deleted).toBe(false);
    });
  });
  
  describe('archive() and restore()', () => {
    it('should archive a test case', async () => {
      const created = await manager.create(createMockInput());
      const archived = await manager.archive(created.id);
      
      expect(archived.status).toBe(TEST_CASE_STATUS.ARCHIVED);
    });
    
    it('should restore an archived test case', async () => {
      const created = await manager.create(createMockInput());
      await manager.archive(created.id);
      const restored = await manager.restore(created.id);
      
      expect(restored.status).toBe(TEST_CASE_STATUS.ACTIVE);
    });
  });
  
  describe('duplicate()', () => {
    it('should duplicate a test case', async () => {
      const original = await manager.create(createMockInput({
        name: 'Original',
        tags: ['tag1', 'tag2'],
      }));
      
      const duplicate = await manager.duplicate(original.id);
      
      expect(duplicate.id).not.toBe(original.id);
      expect(duplicate.name).toBe('Original (Copy)');
      expect(duplicate.tags).toEqual(original.tags);
      expect(duplicate.metadata?.duplicatedFrom).toBe(original.id);
    });
    
    it('should allow custom name for duplicate', async () => {
      const original = await manager.create(createMockInput());
      const duplicate = await manager.duplicate(original.id, {
        name: 'Custom Name',
      });
      
      expect(duplicate.name).toBe('Custom Name');
    });
  });
});

// ============================================================================
// SEARCH AND FILTER TESTS
// ============================================================================

describe('TestCaseManager search', () => {
  let manager: TestCaseManager;
  
  beforeEach(async () => {
    manager = createTestCaseManager();
    
    // Create test data
    await manager.create(createMockInput({
      name: 'Login Test',
      tags: ['smoke', 'auth'],
      projectId: 'project-1',
    }));
    await manager.create(createMockInput({
      name: 'Registration Test',
      tags: ['smoke', 'user'],
      projectId: 'project-1',
    }));
    await manager.create(createMockInput({
      name: 'Dashboard Test',
      tags: ['regression'],
      projectId: 'project-2',
    }));
  });
  
  afterEach(async () => {
    await manager.clear();
  });
  
  it('should search by tags', async () => {
    const results = await manager.search({ tags: ['smoke'] });
    
    expect(results).toHaveLength(2);
  });
  
  it('should search by project', async () => {
    const results = await manager.search({ projectId: 'project-1' });
    
    expect(results).toHaveLength(2);
  });
  
  it('should search by text', async () => {
    const results = await manager.search({ search: 'Login' });
    
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Login Test');
  });
  
  it('should sort by name ascending', async () => {
    const results = await manager.search(
      {},
      { field: 'name', direction: 'asc' }
    );
    
    expect(results[0].name).toBe('Dashboard Test');
    expect(results[2].name).toBe('Registration Test');
  });
  
  it('should sort by name descending', async () => {
    const results = await manager.search(
      {},
      { field: 'name', direction: 'desc' }
    );
    
    expect(results[0].name).toBe('Registration Test');
    expect(results[2].name).toBe('Dashboard Test');
  });
  
  it('should paginate results', async () => {
    const page1 = await manager.searchPaginated(
      {},
      { field: 'name', direction: 'asc' },
      { page: 1, pageSize: 2 }
    );
    
    expect(page1.items).toHaveLength(2);
    expect(page1.total).toBe(3);
    expect(page1.totalPages).toBe(2);
    expect(page1.hasNext).toBe(true);
    expect(page1.hasPrevious).toBe(false);
    
    const page2 = await manager.searchPaginated(
      {},
      { field: 'name', direction: 'asc' },
      { page: 2, pageSize: 2 }
    );
    
    expect(page2.items).toHaveLength(1);
    expect(page2.hasNext).toBe(false);
    expect(page2.hasPrevious).toBe(true);
  });
  
  it('should filter by status', async () => {
    const created = await manager.create(createMockInput({ name: 'Archived' }));
    await manager.archive(created.id);
    
    const active = await manager.search({ status: TEST_CASE_STATUS.DRAFT });
    const archived = await manager.search({ status: TEST_CASE_STATUS.ARCHIVED });
    
    expect(active).toHaveLength(3);
    expect(archived).toHaveLength(1);
  });
});

// ============================================================================
// VERSIONING TESTS
// ============================================================================

describe('TestCaseManager versioning', () => {
  let manager: TestCaseManager;
  
  beforeEach(() => {
    manager = createTestCaseManager({ enableVersioning: true });
  });
  
  afterEach(async () => {
    await manager.clear();
  });
  
  it('should save version on update', async () => {
    const created = await manager.create(createMockInput({ name: 'V1' }));
    await manager.update(created.id, { name: 'V2' });
    await manager.update(created.id, { name: 'V3' });
    
    const versions = await manager.getVersionHistory(created.id);
    
    expect(versions).toHaveLength(2);
    expect(versions[0].version).toBe(1);
    expect(versions[1].version).toBe(2);
  });
  
  it('should restore a previous version', async () => {
    const created = await manager.create(createMockInput({ name: 'Original' }));
    await manager.update(created.id, { name: 'Modified' });
    
    const restored = await manager.restoreVersion(created.id, 1);
    
    expect(restored.name).toBe('Original');
    expect(restored.version).toBe(3);
  });
});

// ============================================================================
// STEPS MANAGEMENT TESTS
// ============================================================================

describe('TestCaseManager steps', () => {
  let manager: TestCaseManager;
  let testCaseId: string;
  
  beforeEach(async () => {
    manager = createTestCaseManager();
    const testCase = await manager.create(createMockInput({
      steps: [
        createMockStep({ id: 'step-1', type: 'click' }),
        createMockStep({ id: 'step-2', type: 'input' }),
      ],
    }));
    testCaseId = testCase.id;
  });
  
  afterEach(async () => {
    await manager.clear();
  });
  
  it('should add step at end', async () => {
    const newStep = createMockStep({ id: 'step-3', type: 'click' });
    const updated = await manager.addStep(testCaseId, newStep);
    
    expect(updated.steps).toHaveLength(3);
    expect(updated.steps[2].id).toBe('step-3');
  });
  
  it('should add step at index', async () => {
    const newStep = createMockStep({ id: 'step-3', type: 'click' });
    const updated = await manager.addStep(testCaseId, newStep, 1);
    
    expect(updated.steps).toHaveLength(3);
    expect(updated.steps[1].id).toBe('step-3');
  });
  
  it('should remove step', async () => {
    const updated = await manager.removeStep(testCaseId, 0);
    
    expect(updated.steps).toHaveLength(1);
    expect(updated.steps[0].id).toBe('step-2');
  });
  
  it('should update step', async () => {
    const updated = await manager.updateStep(testCaseId, 0, { value: 'new value' });
    
    expect(updated.steps[0].value).toBe('new value');
  });
  
  it('should reorder steps', async () => {
    const updated = await manager.reorderStep(testCaseId, 0, 1);
    
    expect(updated.steps[0].id).toBe('step-2');
    expect(updated.steps[1].id).toBe('step-1');
  });
});

// ============================================================================
// TAGS MANAGEMENT TESTS
// ============================================================================

describe('TestCaseManager tags', () => {
  let manager: TestCaseManager;
  
  beforeEach(() => {
    manager = createTestCaseManager();
  });
  
  afterEach(async () => {
    await manager.clear();
  });
  
  it('should add tags', async () => {
    const created = await manager.create(createMockInput({ tags: ['tag1'] }));
    const updated = await manager.addTags(created.id, ['tag2', 'tag3']);
    
    expect(updated.tags).toEqual(['tag1', 'tag2', 'tag3']);
  });
  
  it('should remove tags', async () => {
    const created = await manager.create(createMockInput({ tags: ['tag1', 'tag2', 'tag3'] }));
    const updated = await manager.removeTags(created.id, ['tag2']);
    
    expect(updated.tags).toEqual(['tag1', 'tag3']);
  });
  
  it('should get all unique tags', async () => {
    await manager.create(createMockInput({ tags: ['a', 'b'] }));
    await manager.create(createMockInput({ tags: ['b', 'c'] }));
    
    const allTags = await manager.getAllTags();
    
    expect(allTags).toEqual(['a', 'b', 'c']);
  });
});

// ============================================================================
// IMPORT/EXPORT TESTS
// ============================================================================

describe('TestCaseManager import/export', () => {
  let manager: TestCaseManager;
  
  beforeEach(() => {
    manager = createTestCaseManager();
  });
  
  afterEach(async () => {
    await manager.clear();
  });
  
  it('should export to JSON', async () => {
    const created = await manager.create(createMockInput({ name: 'Export Test' }));
    const json = await manager.exportToJson(created.id);
    const parsed = JSON.parse(json);
    
    expect(parsed.name).toBe('Export Test');
    expect(parsed.id).toBe(created.id);
  });
  
  it('should import from JSON', async () => {
    const original = await manager.create(createMockInput({ name: 'Original' }));
    const json = await manager.exportToJson(original.id);
    
    const imported = await manager.importFromJson(json);
    
    expect(imported.id).not.toBe(original.id);
    expect(imported.name).toBe('Original');
    expect(imported.metadata?.importedFrom).toBe(original.id);
  });
  
  it('should export multiple test cases', async () => {
    const tc1 = await manager.create(createMockInput({ name: 'Test 1' }));
    const tc2 = await manager.create(createMockInput({ name: 'Test 2' }));
    
    const json = await manager.exportMultipleToJson([tc1.id, tc2.id]);
    const parsed = JSON.parse(json);
    
    expect(parsed).toHaveLength(2);
  });
});

// ============================================================================
// EVENT TESTS
// ============================================================================

describe('TestCaseManager events', () => {
  let manager: TestCaseManager;
  
  beforeEach(() => {
    manager = createTestCaseManager();
  });
  
  afterEach(async () => {
    await manager.clear();
  });
  
  it('should emit created event', async () => {
    const listener = vi.fn();
    manager.addEventListener(listener);
    
    await manager.create(createMockInput());
    
    expect(listener).toHaveBeenCalledWith(
      'created',
      expect.objectContaining({ name: 'Test Case' }),
      undefined
    );
  });
  
  it('should emit updated event', async () => {
    const created = await manager.create(createMockInput());
    const listener = vi.fn();
    manager.addEventListener(listener);
    
    await manager.update(created.id, { name: 'Updated' });
    
    expect(listener).toHaveBeenCalledWith(
      'updated',
      expect.objectContaining({ name: 'Updated' }),
      expect.objectContaining({ previousVersion: 1 })
    );
  });
  
  it('should emit deleted event', async () => {
    const created = await manager.create(createMockInput());
    const listener = vi.fn();
    manager.addEventListener(listener);
    
    await manager.delete(created.id);
    
    expect(listener).toHaveBeenCalledWith(
      'deleted',
      expect.objectContaining({ id: created.id }),
      undefined
    );
  });
  
  it('should unsubscribe listener', async () => {
    const listener = vi.fn();
    const unsubscribe = manager.addEventListener(listener);
    
    unsubscribe();
    await manager.create(createMockInput());
    
    expect(listener).not.toHaveBeenCalled();
  });
});

// ============================================================================
// STATISTICS TESTS
// ============================================================================

describe('TestCaseManager statistics', () => {
  let manager: TestCaseManager;
  
  beforeEach(() => {
    manager = createTestCaseManager();
  });
  
  afterEach(async () => {
    await manager.clear();
  });
  
  it('should track statistics', async () => {
    const created = await manager.create(createMockInput());
    await manager.get(created.id);
    await manager.update(created.id, { name: 'Updated' });
    await manager.delete(created.id);
    
    const stats = manager.getStats();
    
    expect(stats.created).toBe(1);
    expect(stats.retrieved).toBeGreaterThanOrEqual(1); // May include internal get() calls
    expect(stats.updated).toBe(1);
    expect(stats.deleted).toBe(1);
  });
  
  it('should reset statistics', async () => {
    await manager.create(createMockInput());
    manager.resetStats();
    
    const stats = manager.getStats();
    
    expect(stats.created).toBe(0);
  });
  
  it('should count test cases', async () => {
    await manager.create(createMockInput({ tags: ['smoke'] }));
    await manager.create(createMockInput({ tags: ['regression'] }));
    
    const total = await manager.count();
    const smokeCount = await manager.count({ tags: ['smoke'] });
    
    expect(total).toBe(2);
    expect(smokeCount).toBe(1);
  });
});
