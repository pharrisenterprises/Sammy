/**
 * MemoryStorageProvider Test Suite
 * @module core/storage/MemoryStorageProvider.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  MemoryStorageProvider,
  createMemoryStorage,
  getMemoryStorage,
  resetMemoryStorage,
  estimateSize,
  deepClone,
  matchesPattern,
  DEFAULT_MEMORY_QUOTA,
} from './MemoryStorageProvider';

// ============================================================================
// HELPER FUNCTION TESTS
// ============================================================================

describe('estimateSize', () => {
  it('should estimate null size', () => {
    expect(estimateSize(null)).toBe(4);
  });
  
  it('should estimate boolean size', () => {
    expect(estimateSize(true)).toBe(4);
    expect(estimateSize(false)).toBe(4);
  });
  
  it('should estimate number size', () => {
    expect(estimateSize(42)).toBe(8);
    expect(estimateSize(3.14)).toBe(8);
  });
  
  it('should estimate string size', () => {
    expect(estimateSize('hello')).toBe(10); // 5 chars * 2 bytes
    expect(estimateSize('')).toBe(0);
  });
  
  it('should estimate array size', () => {
    const size = estimateSize([1, 2, 3]);
    expect(size).toBeGreaterThan(0);
  });
  
  it('should estimate object size', () => {
    const size = estimateSize({ a: 1, b: 'test' });
    expect(size).toBeGreaterThan(0);
  });
});

describe('deepClone', () => {
  it('should clone primitives', () => {
    expect(deepClone(null)).toBeNull();
    expect(deepClone(42)).toBe(42);
    expect(deepClone('test')).toBe('test');
    expect(deepClone(true)).toBe(true);
  });
  
  it('should clone arrays', () => {
    const original = [1, 2, { a: 3 }];
    const cloned = deepClone(original);
    
    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    expect(cloned[2]).not.toBe(original[2]);
  });
  
  it('should clone objects', () => {
    const original = { a: 1, b: { c: 2 } };
    const cloned = deepClone(original);
    
    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    expect(cloned.b).not.toBe(original.b);
  });
});

describe('matchesPattern', () => {
  it('should match regex patterns', () => {
    expect(matchesPattern('test-123', /^test-\d+$/)).toBe(true);
    expect(matchesPattern('other-123', /^test-\d+$/)).toBe(false);
  });
  
  it('should match glob patterns', () => {
    expect(matchesPattern('test-123', 'test-*')).toBe(true);
    expect(matchesPattern('other-123', 'test-*')).toBe(false);
  });
  
  it('should match exact strings', () => {
    expect(matchesPattern('test', 'test')).toBe(true);
    expect(matchesPattern('test', 'other')).toBe(false);
  });
  
  it('should handle ? wildcard', () => {
    expect(matchesPattern('test1', 'test?')).toBe(true);
    expect(matchesPattern('test12', 'test?')).toBe(false);
  });
});

// ============================================================================
// PROVIDER TESTS
// ============================================================================

describe('MemoryStorageProvider', () => {
  let storage: MemoryStorageProvider;
  
  beforeEach(async () => {
    storage = createMemoryStorage({ enableCleanup: false });
    await storage.initialize();
  });
  
  afterEach(async () => {
    await storage.close();
  });
  
  describe('initialization', () => {
    it('should initialize correctly', () => {
      expect(storage.isReady).toBe(true);
      expect(storage.type).toBe('memory');
    });
    
    it('should close correctly', async () => {
      await storage.close();
      expect(storage.isReady).toBe(false);
    });
    
    it('should load initial data', async () => {
      const storageWithData = createMemoryStorage({
        enableCleanup: false,
        initialData: {
          testCases: { key1: 'value1' },
          steps: { key2: 'value2' },
        },
      });
      await storageWithData.initialize();
      
      expect(await storageWithData.get('key1', 'testCases')).toBe('value1');
      expect(await storageWithData.get('key2', 'steps')).toBe('value2');
      
      await storageWithData.close();
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
    
    it('should deep clone on get to prevent mutation', async () => {
      const obj = { a: 1 };
      await storage.set('key', obj);
      
      const result1 = await storage.get<{ a: number }>('key');
      result1!.a = 999;
      
      const result2 = await storage.get<{ a: number }>('key');
      expect(result2!.a).toBe(1);
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
      
      expect(testCaseKeys).toEqual(['a', 'b']);
      expect(stepKeys).toEqual(['c']);
    });
    
    it('should clear specific area', async () => {
      await storage.set('a', 1, 'testCases');
      await storage.set('b', 2, 'steps');
      
      const cleared = await storage.clear('testCases');
      
      expect(cleared).toBe(1);
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
    
    it('should update metadata on set', async () => {
      await storage.set('key', 'value1');
      const entry1 = await storage.getWithMetadata('key');
      
      await new Promise(r => setTimeout(r, 10));
      await storage.set('key', 'value2');
      const entry2 = await storage.getWithMetadata('key');
      
      expect(entry2?.metadata?.updatedAt).toBeGreaterThan(entry1?.metadata?.updatedAt ?? 0);
      expect(entry2?.metadata?.createdAt).toBe(entry1?.metadata?.createdAt);
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
      expect(result.entries.map(e => e.key)).toEqual(['test-1', 'test-2']);
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
      
      expect(asc.entries[0].key).toBe('other-1');
      expect(desc.entries[0].key).toBe('test-2');
    });
  });
  
  describe('TTL support', () => {
    it('should expire entries after TTL', async () => {
      await storage.setWithTtl('expiring', 'value', 50);
      
      expect(await storage.has('expiring')).toBe(true);
      
      await new Promise(r => setTimeout(r, 100));
      
      expect(await storage.has('expiring')).toBe(false);
    });
    
    it('should get remaining TTL', async () => {
      await storage.setWithTtl('key', 'value', 1000);
      
      const ttl = await storage.getTtl('key');
      
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(1000);
    });
    
    it('should return -1 for no TTL', async () => {
      await storage.set('key', 'value');
      
      const ttl = await storage.getTtl('key');
      
      expect(ttl).toBe(-1);
    });
    
    it('should return null for nonexistent', async () => {
      const ttl = await storage.getTtl('nonexistent');
      expect(ttl).toBeNull();
    });
    
    it('should cleanup expired entries', async () => {
      await storage.setWithTtl('exp1', 'a', 10);
      await storage.setWithTtl('exp2', 'b', 10);
      await storage.set('keep', 'c');
      
      await new Promise(r => setTimeout(r, 50));
      
      const cleaned = storage.cleanupExpired();
      
      expect(cleaned).toBe(2);
      expect(await storage.has('keep')).toBe(true);
    });
  });
  
  describe('quota management', () => {
    it('should track memory usage', async () => {
      expect(storage.memoryUsage).toBe(0);
      
      await storage.set('key', 'value');
      
      expect(storage.memoryUsage).toBeGreaterThan(0);
    });
    
    it('should report quota', async () => {
      await storage.set('key', 'value');
      
      const quota = await storage.getQuota();
      
      expect(quota.total).toBe(DEFAULT_MEMORY_QUOTA);
      expect(quota.used).toBeGreaterThan(0);
      expect(quota.available).toBeLessThan(quota.total);
      expect(quota.usagePercent).toBeGreaterThan(0);
    });
    
    it('should throw on quota exceeded', async () => {
      const smallStorage = createMemoryStorage({
        maxQuota: 100,
        enableCleanup: false,
      });
      await smallStorage.initialize();
      
      await expect(
        smallStorage.set('key', 'x'.repeat(200))
      ).rejects.toThrow(/quota/i);
      
      await smallStorage.close();
    });
    
    it('should update size on remove', async () => {
      await storage.set('key', 'x'.repeat(100));
      const usageBefore = storage.memoryUsage;
      
      await storage.remove('key');
      
      expect(storage.memoryUsage).toBeLessThan(usageBefore);
    });
  });
  
  describe('transactions', () => {
    it('should execute all operations', async () => {
      const result = await storage.transaction([
        { type: 'set', key: 'a', value: 1 },
        { type: 'set', key: 'b', value: 2 },
      ]);
      
      expect(result.success).toBe(true);
      expect(result.operationsCompleted).toBe(2);
      expect(await storage.get('a')).toBe(1);
      expect(await storage.get('b')).toBe(2);
    });
    
    it('should rollback on error', async () => {
      const smallStorage = createMemoryStorage({
        maxQuota: 50,
        enableCleanup: false,
      });
      await smallStorage.initialize();
      
      await smallStorage.set('existing', 'value');
      
      const result = await smallStorage.transaction([
        { type: 'set', key: 'small', value: 'x' },
        { type: 'set', key: 'large', value: 'x'.repeat(1000) }, // Should fail
      ]);
      
      expect(result.success).toBe(false);
      // Should have rolled back
      expect(await smallStorage.has('small')).toBe(false);
      
      await smallStorage.close();
    });
  });
  
  describe('change events', () => {
    it('should notify on set', async () => {
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
    
    it('should notify on remove', async () => {
      await storage.set('key', 'value');
      
      const listener = vi.fn();
      storage.onChange(listener);
      
      await storage.remove('key');
      
      expect(listener).toHaveBeenCalledWith([
        expect.objectContaining({
          key: 'key',
          type: 'remove',
          oldValue: 'value',
        }),
      ]);
    });
    
    it('should batch notify on setMany', async () => {
      const listener = vi.fn();
      storage.onChange(listener);
      
      await storage.setMany([
        { key: 'a', value: 1 },
        { key: 'b', value: 2 },
      ]);
      
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0]).toHaveLength(2);
    });
  });
  
  describe('statistics', () => {
    it('should return stats', async () => {
      await storage.set('a', 1, 'testCases');
      await storage.set('b', 2, 'steps');
      await storage.set('c', 'x'.repeat(100), 'config');
      
      const stats = await storage.getStats();
      
      expect(stats.itemCount).toBe(3);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.countByArea.testCases).toBe(1);
      expect(stats.countByArea.steps).toBe(1);
      expect(stats.countByArea.config).toBe(1);
      expect(stats.largestItems.length).toBeGreaterThan(0);
    });
  });
  
  describe('export/import', () => {
    it('should export data', async () => {
      await storage.set('key1', 'value1', 'testCases');
      await storage.set('key2', 'value2', 'steps');
      
      const exported = await storage.export();
      const parsed = JSON.parse(exported);
      
      expect(parsed.version).toBe(1);
      expect(parsed.data.testCases).toBeDefined();
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
      
      expect(result.imported).toBe(1);
      expect(await storage.get('imported', 'testCases')).toBe('data');
    });
  });
});

// ============================================================================
// SINGLETON TESTS
// ============================================================================

describe('getMemoryStorage (singleton)', () => {
  beforeEach(() => {
    resetMemoryStorage();
  });
  
  afterEach(() => {
    resetMemoryStorage();
  });
  
  it('should return same instance', () => {
    const instance1 = getMemoryStorage();
    const instance2 = getMemoryStorage();
    
    expect(instance1).toBe(instance2);
  });
  
  it('should reset on resetMemoryStorage', () => {
    const instance1 = getMemoryStorage();
    resetMemoryStorage();
    const instance2 = getMemoryStorage();
    
    expect(instance1).not.toBe(instance2);
  });
});
