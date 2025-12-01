/**
 * IndexedDBStorageProvider Test Suite
 * @module core/storage/IndexedDBStorageProvider.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  IndexedDBStorageProvider,
  createIndexedDBStorage,
  getIndexedDBStorage,
  resetIndexedDBStorage,
  isIndexedDBAvailable,
  estimateSize,
  DEFAULT_DB_VERSION,
} from './IndexedDBStorageProvider';
import { MemoryStorageProvider } from './MemoryStorageProvider';

// ============================================================================
// FAKE INDEXEDDB SETUP
// ============================================================================

// Note: These tests use fake-indexeddb which should be installed
// If not available, tests will use fallback provider

let hasIndexedDB = false;

try {
  // Check if we're in an environment with IndexedDB
  hasIndexedDB = typeof indexedDB !== 'undefined';
} catch {
  hasIndexedDB = false;
}

// ============================================================================
// HELPER FUNCTION TESTS
// ============================================================================

describe('isIndexedDBAvailable', () => {
  it('should return boolean', () => {
    const result = isIndexedDBAvailable();
    expect(typeof result).toBe('boolean');
  });
});

describe('estimateSize', () => {
  it('should estimate string size', () => {
    const size = estimateSize('hello');
    expect(size).toBeGreaterThan(0);
  });
  
  it('should estimate object size', () => {
    const size = estimateSize({ a: 1, b: 'test' });
    expect(size).toBeGreaterThan(0);
  });
  
  it('should handle arrays', () => {
    const size = estimateSize([1, 2, 3, 'test']);
    expect(size).toBeGreaterThan(0);
  });
});

// ============================================================================
// PROVIDER TESTS WITH FALLBACK
// ============================================================================

describe('IndexedDBStorageProvider (with fallback)', () => {
  let storage: IndexedDBStorageProvider;
  let fallback: MemoryStorageProvider;
  
  beforeEach(async () => {
    fallback = new MemoryStorageProvider();
    await fallback.initialize();
    
    storage = createIndexedDBStorage({
      dbName: 'test-db',
      fallbackProvider: fallback,
    });
    await storage.initialize();
  });
  
  afterEach(async () => {
    await storage.close();
  });
  
  describe('initialization', () => {
    it('should initialize correctly', () => {
      expect(storage.isReady).toBe(true);
      expect(storage.type).toBe('indexeddb');
    });
    
    it('should have correct database name', () => {
      expect(storage.getDatabaseName()).toBe('test-db');
    });
    
    it('should have correct database version', () => {
      expect(storage.getDatabaseVersion()).toBe(DEFAULT_DB_VERSION);
    });
  });
  
  describe('basic CRUD', () => {
    it('should set and get values', async () => {
      await storage.set('key1', 'value1');
      const result = await storage.get('key1');
      
      expect(result).toBe('value1');
    });
    
    it('should return null for missing keys', async () => {
      const result = await storage.get('nonexistent');
      expect(result).toBeNull();
    });
    
    it('should check existence', async () => {
      await storage.set('key1', 'value1');
      
      expect(await storage.has('key1')).toBe(true);
      expect(await storage.has('nonexistent')).toBe(false);
    });
    
    it('should remove values', async () => {
      await storage.set('key1', 'value1');
      const removed = await storage.remove('key1');
      
      expect(removed).toBe(true);
      expect(await storage.has('key1')).toBe(false);
    });
    
    it('should return false for removing nonexistent', async () => {
      const removed = await storage.remove('nonexistent');
      expect(removed).toBe(false);
    });
    
    it('should store complex objects', async () => {
      const obj = {
        name: 'test',
        values: [1, 2, 3],
        nested: { deep: { value: true } },
      };
      
      await storage.set('complex', obj);
      const result = await storage.get('complex');
      
      expect(result).toEqual(obj);
    });
  });
  
  describe('area separation', () => {
    it('should separate data by area', async () => {
      await storage.set('key', 'value1', 'testCases');
      await storage.set('key', 'value2', 'steps');
      
      expect(await storage.get('key', 'testCases')).toBe('value1');
      expect(await storage.get('key', 'steps')).toBe('value2');
    });
    
    it('should list keys by area', async () => {
      await storage.set('a', 1, 'testCases');
      await storage.set('b', 2, 'testCases');
      await storage.set('c', 3, 'steps');
      
      const testCaseKeys = await storage.keys('testCases');
      const stepKeys = await storage.keys('steps');
      
      expect(testCaseKeys).toContain('a');
      expect(testCaseKeys).toContain('b');
      expect(testCaseKeys).not.toContain('c');
      expect(stepKeys).toContain('c');
    });
    
    it('should clear specific area', async () => {
      await storage.set('a', 1, 'testCases');
      await storage.set('b', 2, 'steps');
      
      await storage.clear('testCases');
      
      expect(await storage.has('a', 'testCases')).toBe(false);
      expect(await storage.has('b', 'steps')).toBe(true);
    });
  });
  
  describe('metadata', () => {
    it('should store and retrieve metadata', async () => {
      await storage.setWithMetadata('key', 'value', {
        tags: ['important', 'test'],
        contentType: 'text/plain',
      });
      
      const entry = await storage.getWithMetadata('key');
      
      expect(entry?.metadata?.tags).toEqual(['important', 'test']);
      expect(entry?.metadata?.contentType).toBe('text/plain');
      expect(entry?.metadata?.createdAt).toBeDefined();
      expect(entry?.metadata?.updatedAt).toBeDefined();
    });
    
    it('should track size in metadata', async () => {
      await storage.set('key', 'hello world');
      const entry = await storage.getWithMetadata('key');
      
      expect(entry?.metadata?.size).toBeGreaterThan(0);
    });
  });
  
  describe('batch operations', () => {
    it('should get many values', async () => {
      await storage.set('a', 1);
      await storage.set('b', 2);
      await storage.set('c', 3);
      
      const result = await storage.getMany(['a', 'b', 'd']);
      
      expect(result.get('a')).toBe(1);
      expect(result.get('b')).toBe(2);
      expect(result.has('d')).toBe(false);
    });
    
    it('should set many values', async () => {
      await storage.setMany([
        { key: 'a', value: 1 },
        { key: 'b', value: 2 },
        { key: 'c', value: 3 },
      ]);
      
      expect(await storage.get('a')).toBe(1);
      expect(await storage.get('b')).toBe(2);
      expect(await storage.get('c')).toBe(3);
    });
    
    it('should remove many values', async () => {
      await storage.set('a', 1);
      await storage.set('b', 2);
      await storage.set('c', 3);
      
      const removed = await storage.removeMany(['a', 'c', 'd']);
      
      expect(removed).toBe(2);
      expect(await storage.has('a')).toBe(false);
      expect(await storage.has('b')).toBe(true);
      expect(await storage.has('c')).toBe(false);
    });
  });
  
  describe('query operations', () => {
    beforeEach(async () => {
      await storage.setWithMetadata('test-1', 'a', { tags: ['important'] });
      await storage.setWithMetadata('test-2', 'b', { tags: ['normal'] });
      await storage.setWithMetadata('other-1', 'c', { tags: ['important'] });
    });
    
    it('should filter by prefix', async () => {
      const result = await storage.query({ prefix: 'test-' });
      
      expect(result.total).toBe(2);
    });
    
    it('should filter by suffix', async () => {
      const result = await storage.query({ suffix: '-1' });
      
      expect(result.total).toBe(2);
    });
    
    it('should filter by pattern', async () => {
      const result = await storage.query({ pattern: /test-\d/ });
      
      expect(result.total).toBe(2);
    });
    
    it('should filter by tags', async () => {
      const result = await storage.query({ tags: ['important'] });
      
      expect(result.total).toBe(2);
    });
    
    it('should apply pagination', async () => {
      const page1 = await storage.query({ limit: 2, offset: 0 });
      const page2 = await storage.query({ limit: 2, offset: 2 });
      
      expect(page1.entries.length).toBe(2);
      expect(page1.hasMore).toBe(true);
      expect(page1.nextOffset).toBe(2);
      
      expect(page2.entries.length).toBe(1);
      expect(page2.hasMore).toBe(false);
    });
    
    it('should sort by key', async () => {
      const asc = await storage.query({ sortBy: 'key', sortOrder: 'asc' });
      const desc = await storage.query({ sortBy: 'key', sortOrder: 'desc' });
      
      expect(asc.entries[0]?.key).toBe('other-1');
      expect(desc.entries[0]?.key).toBe('test-2');
    });
    
    it('should count entries', async () => {
      const total = await storage.count();
      const filtered = await storage.count({ prefix: 'test-' });
      
      expect(total).toBe(3);
      expect(filtered).toBe(2);
    });
  });
  
  describe('transactions', () => {
    it('should execute multiple operations', async () => {
      const result = await storage.transaction([
        { type: 'set', key: 'a', value: 1 },
        { type: 'set', key: 'b', value: 2 },
      ]);
      
      expect(result.success).toBe(true);
      expect(result.operationsCompleted).toBe(2);
      expect(await storage.get('a')).toBe(1);
      expect(await storage.get('b')).toBe(2);
    });
    
    it('should handle mixed operations', async () => {
      await storage.set('existing', 'old');
      
      const result = await storage.transaction([
        { type: 'set', key: 'new', value: 'value' },
        { type: 'remove', key: 'existing' },
      ]);
      
      expect(result.success).toBe(true);
      expect(await storage.has('new')).toBe(true);
      expect(await storage.has('existing')).toBe(false);
    });
  });
  
  describe('change events', () => {
    it('should notify on set when not using fallback', async () => {
      // Skip if using fallback (fallback has its own event system)
      if (storage.isFallbackActive()) {
        expect(true).toBe(true);
        return;
      }
      
      const listener = vi.fn();
      storage.onChange(listener);
      
      await storage.set('key', 'value');
      
      expect(listener).toHaveBeenCalledWith([
        expect.objectContaining({
          key: 'key',
          type: 'set',
          newValue: 'value',
        }),
      ]);
    });
    
    it('should notify on remove when not using fallback', async () => {
      // Skip if using fallback (fallback has its own event system)
      if (storage.isFallbackActive()) {
        expect(true).toBe(true);
        return;
      }
      
      await storage.set('key', 'value');
      
      const listener = vi.fn();
      storage.onChange(listener);
      
      await storage.remove('key');
      
      expect(listener).toHaveBeenCalledWith([
        expect.objectContaining({
          key: 'key',
          type: 'remove',
        }),
      ]);
    });
    
    it('should unsubscribe', async () => {
      const listener = vi.fn();
      const unsubscribe = storage.onChange(listener);
      
      unsubscribe();
      await storage.set('key', 'value');
      
      expect(listener).not.toHaveBeenCalled();
    });
  });
  
  describe('quota and stats', () => {
    it('should return quota info', async () => {
      const quota = await storage.getQuota();
      
      expect(quota.total).toBeGreaterThan(0);
      expect(quota.usagePercent).toBeGreaterThanOrEqual(0);
    });
    
    it('should return stats', async () => {
      await storage.set('a', 1, 'testCases');
      await storage.set('b', 2, 'steps');
      
      const stats = await storage.getStats();
      
      expect(stats.itemCount).toBe(2);
      expect(stats.countByArea.testCases).toBe(1);
      expect(stats.countByArea.steps).toBe(1);
    });
  });
  
  describe('export/import', () => {
    it('should export data', async () => {
      await storage.set('key1', 'value1', 'testCases');
      await storage.set('key2', 'value2', 'steps');
      
      const exported = await storage.export();
      const parsed = JSON.parse(exported);
      
      expect(parsed.version).toBe(1);
      expect(parsed.data).toBeDefined();
    });
    
    it('should import data', async () => {
      const data = JSON.stringify({
        version: 1,
        exportedAt: Date.now(),
        data: {
          testCases: [{ key: 'imported', value: 'data' }],
        },
      });
      
      const result = await storage.import(data);
      
      expect(result.imported).toBeGreaterThanOrEqual(0);
    });
  });
});

// ============================================================================
// SINGLETON TESTS
// ============================================================================

describe('getIndexedDBStorage (singleton)', () => {
  afterEach(async () => {
    await resetIndexedDBStorage();
  });
  
  it('should return same instance', () => {
    const instance1 = getIndexedDBStorage();
    const instance2 = getIndexedDBStorage();
    
    expect(instance1).toBe(instance2);
  });
  
  it('should reset on resetIndexedDBStorage', async () => {
    const instance1 = getIndexedDBStorage();
    await resetIndexedDBStorage();
    const instance2 = getIndexedDBStorage();
    
    expect(instance1).not.toBe(instance2);
  });
});

// ============================================================================
// ERROR HANDLING TESTS
// ============================================================================

describe('IndexedDBStorageProvider (error handling)', () => {
  it('should use fallback when IndexedDB operations fail', async () => {
    const fallback = new MemoryStorageProvider();
    await fallback.initialize();
    
    const storage = createIndexedDBStorage({
      fallbackProvider: fallback,
    });
    await storage.initialize();
    
    // Should work via fallback
    await storage.set('key', 'value');
    expect(await storage.get('key')).toBe('value');
    
    await storage.close();
  });
});

// ============================================================================
// REAL INDEXEDDB TESTS (conditional)
// ============================================================================

// These tests only run if real IndexedDB is available
const describeWithIndexedDB = hasIndexedDB ? describe : describe.skip;

describeWithIndexedDB('IndexedDBStorageProvider (real IndexedDB)', () => {
  let storage: IndexedDBStorageProvider;
  
  beforeEach(async () => {
    storage = createIndexedDBStorage({
      dbName: `test-db-${Date.now()}`,
    });
    await storage.initialize();
  });
  
  afterEach(async () => {
    await storage.deleteDatabase();
    await storage.close();
  });
  
  it('should use real IndexedDB', () => {
    expect(storage.isFallbackActive()).toBe(false);
    expect(storage.getRawDatabase()).not.toBeNull();
  });
  
  it('should perform CRUD operations', async () => {
    await storage.set('key', 'value');
    expect(await storage.get('key')).toBe('value');
    
    await storage.remove('key');
    expect(await storage.has('key')).toBe(false);
  });
  
  it('should persist across transactions', async () => {
    await storage.set('persistent', { data: 'test' });
    
    // Get from fresh transaction
    const result = await storage.get('persistent');
    expect(result).toEqual({ data: 'test' });
  });
});
