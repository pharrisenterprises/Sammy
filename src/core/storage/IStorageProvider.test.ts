/**
 * IStorageProvider Test Suite
 * @module core/storage/IStorageProvider.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BaseStorageProvider,
  isStorableValue,
  isStorageArea,
  isStorageType,
  type StorageType,
  type StorageArea,
  type StorableValue,
  type StorageQuota,
  type StorageProviderOptions,
} from './IStorageProvider';

// ============================================================================
// TEST IMPLEMENTATION
// ============================================================================

/**
 * Concrete implementation for testing
 */
class TestStorageProvider extends BaseStorageProvider {
  readonly type: StorageType = 'memory';
  
  private store: Map<string, StorableValue> = new Map();
  
  constructor(options: Partial<StorageProviderOptions> = {}) {
    super({ type: 'memory', ...options });
  }
  
  async initialize(): Promise<void> {
    this._isReady = true;
  }
  
  async close(): Promise<void> {
    this._isReady = false;
    this.store.clear();
  }
  
  async get<T extends StorableValue>(
    key: string,
    area?: StorageArea
  ): Promise<T | null> {
    const fullKey = this.buildKey(key, this.getArea(area));
    return (this.store.get(fullKey) as T) ?? null;
  }
  
  async set<T extends StorableValue>(
    key: string,
    value: T,
    area?: StorageArea
  ): Promise<void> {
    const effectiveArea = this.getArea(area);
    const fullKey = this.buildKey(key, effectiveArea);
    const oldValue = this.store.get(fullKey);
    
    this.store.set(fullKey, value);
    
    this.notifyListeners([{
      key,
      area: effectiveArea,
      type: 'set',
      oldValue,
      newValue: value,
      timestamp: Date.now(),
    }]);
  }
  
  async remove(key: string, area?: StorageArea): Promise<boolean> {
    const effectiveArea = this.getArea(area);
    const fullKey = this.buildKey(key, effectiveArea);
    const existed = this.store.has(fullKey);
    
    if (existed) {
      const oldValue = this.store.get(fullKey);
      this.store.delete(fullKey);
      
      this.notifyListeners([{
        key,
        area: effectiveArea,
        type: 'remove',
        oldValue,
        timestamp: Date.now(),
      }]);
    }
    
    return existed;
  }
  
  async has(key: string, area?: StorageArea): Promise<boolean> {
    const fullKey = this.buildKey(key, this.getArea(area));
    return this.store.has(fullKey);
  }
  
  async keys(area?: StorageArea): Promise<string[]> {
    const prefix = `${this.getArea(area)}:`;
    const result: string[] = [];
    
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        result.push(key.substring(prefix.length));
      }
    }
    
    return result;
  }
  
  async clear(area: StorageArea): Promise<number> {
    const prefix = `${area}:`;
    let count = 0;
    
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        count++;
      }
    }
    
    this.notifyListeners([{
      key: '*',
      area,
      type: 'clear',
      timestamp: Date.now(),
    }]);
    
    return count;
  }
  
  async getQuota(): Promise<StorageQuota> {
    const used = this.store.size * 100; // Rough estimate
    const total = 10 * 1024 * 1024; // 10MB
    
    return {
      total,
      used,
      available: total - used,
      usagePercent: (used / total) * 100,
    };
  }
}

// ============================================================================
// TYPE GUARD TESTS
// ============================================================================

describe('isStorableValue', () => {
  it('should return true for null', () => {
    expect(isStorableValue(null)).toBe(true);
  });
  
  it('should return true for strings', () => {
    expect(isStorableValue('hello')).toBe(true);
    expect(isStorableValue('')).toBe(true);
  });
  
  it('should return true for numbers', () => {
    expect(isStorableValue(42)).toBe(true);
    expect(isStorableValue(0)).toBe(true);
    expect(isStorableValue(-1.5)).toBe(true);
  });
  
  it('should return true for booleans', () => {
    expect(isStorableValue(true)).toBe(true);
    expect(isStorableValue(false)).toBe(true);
  });
  
  it('should return true for arrays of storable values', () => {
    expect(isStorableValue([1, 2, 3])).toBe(true);
    expect(isStorableValue(['a', 'b'])).toBe(true);
    expect(isStorableValue([1, 'a', true, null])).toBe(true);
  });
  
  it('should return true for objects of storable values', () => {
    expect(isStorableValue({ a: 1, b: 'two' })).toBe(true);
    expect(isStorableValue({ nested: { value: true } })).toBe(true);
  });
  
  it('should return false for functions', () => {
    expect(isStorableValue(() => {})).toBe(false);
  });
  
  it('should return false for undefined', () => {
    expect(isStorableValue(undefined)).toBe(false);
  });
  
  it('should return false for symbols', () => {
    expect(isStorableValue(Symbol('test'))).toBe(false);
  });
});

describe('isStorageArea', () => {
  it('should return true for valid areas', () => {
    expect(isStorageArea('testCases')).toBe(true);
    expect(isStorageArea('steps')).toBe(true);
    expect(isStorageArea('config')).toBe(true);
    expect(isStorageArea('state')).toBe(true);
    expect(isStorageArea('cache')).toBe(true);
    expect(isStorageArea('metadata')).toBe(true);
  });
  
  it('should return false for invalid areas', () => {
    expect(isStorageArea('invalid')).toBe(false);
    expect(isStorageArea('')).toBe(false);
    expect(isStorageArea('TESTCASES')).toBe(false);
  });
});

describe('isStorageType', () => {
  it('should return true for valid types', () => {
    expect(isStorageType('chrome-local')).toBe(true);
    expect(isStorageType('chrome-sync')).toBe(true);
    expect(isStorageType('chrome-session')).toBe(true);
    expect(isStorageType('indexeddb')).toBe(true);
    expect(isStorageType('memory')).toBe(true);
    expect(isStorageType('file')).toBe(true);
  });
  
  it('should return false for invalid types', () => {
    expect(isStorageType('invalid')).toBe(false);
    expect(isStorageType('localStorage')).toBe(false);
  });
});

// ============================================================================
// BASE PROVIDER TESTS
// ============================================================================

describe('BaseStorageProvider', () => {
  let provider: TestStorageProvider;
  
  beforeEach(async () => {
    provider = new TestStorageProvider();
    await provider.initialize();
  });
  
  describe('initialization', () => {
    it('should be ready after initialize', () => {
      expect(provider.isReady).toBe(true);
    });
    
    it('should not be ready after close', async () => {
      await provider.close();
      expect(provider.isReady).toBe(false);
    });
    
    it('should have correct type', () => {
      expect(provider.type).toBe('memory');
    });
  });
  
  describe('basic CRUD', () => {
    it('should set and get value', async () => {
      await provider.set('key1', 'value1');
      const result = await provider.get('key1');
      expect(result).toBe('value1');
    });
    
    it('should return null for missing key', async () => {
      const result = await provider.get('nonexistent');
      expect(result).toBeNull();
    });
    
    it('should check existence', async () => {
      await provider.set('key1', 'value1');
      
      expect(await provider.has('key1')).toBe(true);
      expect(await provider.has('nonexistent')).toBe(false);
    });
    
    it('should remove value', async () => {
      await provider.set('key1', 'value1');
      const removed = await provider.remove('key1');
      
      expect(removed).toBe(true);
      expect(await provider.has('key1')).toBe(false);
    });
    
    it('should return false when removing nonexistent', async () => {
      const removed = await provider.remove('nonexistent');
      expect(removed).toBe(false);
    });
    
    it('should store complex objects', async () => {
      const obj = { 
        name: 'test', 
        values: [1, 2, 3], 
        nested: { a: true } 
      };
      
      await provider.set('complex', obj);
      const result = await provider.get('complex');
      
      expect(result).toEqual(obj);
    });
  });
  
  describe('area separation', () => {
    it('should separate data by area', async () => {
      await provider.set('key1', 'value1', 'testCases');
      await provider.set('key1', 'value2', 'steps');
      
      expect(await provider.get('key1', 'testCases')).toBe('value1');
      expect(await provider.get('key1', 'steps')).toBe('value2');
    });
    
    it('should list keys by area', async () => {
      await provider.set('a', 1, 'testCases');
      await provider.set('b', 2, 'testCases');
      await provider.set('c', 3, 'steps');
      
      const testCaseKeys = await provider.keys('testCases');
      const stepKeys = await provider.keys('steps');
      
      expect(testCaseKeys).toContain('a');
      expect(testCaseKeys).toContain('b');
      expect(testCaseKeys).not.toContain('c');
      expect(stepKeys).toContain('c');
    });
    
    it('should clear specific area', async () => {
      await provider.set('a', 1, 'testCases');
      await provider.set('b', 2, 'steps');
      
      await provider.clear('testCases');
      
      expect(await provider.has('a', 'testCases')).toBe(false);
      expect(await provider.has('b', 'steps')).toBe(true);
    });
  });
  
  describe('batch operations', () => {
    it('should get many values', async () => {
      await provider.set('a', 1);
      await provider.set('b', 2);
      await provider.set('c', 3);
      
      const result = await provider.getMany(['a', 'b', 'd']);
      
      expect(result.get('a')).toBe(1);
      expect(result.get('b')).toBe(2);
      expect(result.has('d')).toBe(false);
    });
    
    it('should set many values', async () => {
      await provider.setMany([
        { key: 'a', value: 1 },
        { key: 'b', value: 2 },
      ]);
      
      expect(await provider.get('a')).toBe(1);
      expect(await provider.get('b')).toBe(2);
    });
    
    it('should remove many values', async () => {
      await provider.set('a', 1);
      await provider.set('b', 2);
      await provider.set('c', 3);
      
      const removed = await provider.removeMany(['a', 'c']);
      
      expect(removed).toBe(2);
      expect(await provider.has('a')).toBe(false);
      expect(await provider.has('b')).toBe(true);
      expect(await provider.has('c')).toBe(false);
    });
  });
  
  describe('query operations', () => {
    beforeEach(async () => {
      await provider.set('test-1', 'a');
      await provider.set('test-2', 'b');
      await provider.set('other-1', 'c');
    });
    
    it('should filter by prefix', async () => {
      const result = await provider.query({ prefix: 'test-' });
      
      expect(result.entries.length).toBe(2);
      expect(result.entries.map(e => e.key)).toContain('test-1');
      expect(result.entries.map(e => e.key)).toContain('test-2');
    });
    
    it('should apply limit and offset', async () => {
      const result = await provider.query({ limit: 1, offset: 1 });
      
      expect(result.entries.length).toBe(1);
      expect(result.hasMore).toBe(true);
    });
    
    it('should sort by key', async () => {
      const asc = await provider.query({ sortBy: 'key', sortOrder: 'asc' });
      const desc = await provider.query({ sortBy: 'key', sortOrder: 'desc' });
      
      expect(asc.entries[0].key).not.toBe(desc.entries[0].key);
    });
    
    it('should count entries', async () => {
      const total = await provider.count();
      const filtered = await provider.count({ prefix: 'test-' });
      
      expect(total).toBe(3);
      expect(filtered).toBe(2);
    });
  });
  
  describe('change events', () => {
    it('should notify on set', async () => {
      const listener = vi.fn();
      provider.onChange(listener);
      
      await provider.set('key', 'value');
      
      expect(listener).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            key: 'key',
            type: 'set',
            newValue: 'value',
          }),
        ])
      );
    });
    
    it('should notify on remove', async () => {
      await provider.set('key', 'value');
      
      const listener = vi.fn();
      provider.onChange(listener);
      
      await provider.remove('key');
      
      expect(listener).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            key: 'key',
            type: 'remove',
            oldValue: 'value',
          }),
        ])
      );
    });
    
    it('should unsubscribe', async () => {
      const listener = vi.fn();
      const unsubscribe = provider.onChange(listener);
      
      unsubscribe();
      await provider.set('key', 'value');
      
      expect(listener).not.toHaveBeenCalled();
    });
    
    it('should filter by area', async () => {
      const listener = vi.fn();
      provider.onChange(listener, 'testCases');
      
      await provider.set('key', 'value', 'steps');
      expect(listener).not.toHaveBeenCalled();
      
      await provider.set('key', 'value', 'testCases');
      expect(listener).toHaveBeenCalled();
    });
  });
  
  describe('transactions', () => {
    it('should execute multiple operations', async () => {
      const result = await provider.transaction([
        { type: 'set', key: 'a', value: 1 },
        { type: 'set', key: 'b', value: 2 },
      ]);
      
      expect(result.success).toBe(true);
      expect(result.operationsCompleted).toBe(2);
      expect(await provider.get('a')).toBe(1);
      expect(await provider.get('b')).toBe(2);
    });
    
    it('should handle mixed operations', async () => {
      await provider.set('existing', 'old');
      
      const result = await provider.transaction([
        { type: 'set', key: 'new', value: 'value' },
        { type: 'remove', key: 'existing' },
      ]);
      
      expect(result.success).toBe(true);
      expect(await provider.has('new')).toBe(true);
      expect(await provider.has('existing')).toBe(false);
    });
  });
  
  describe('export/import', () => {
    it('should export data', async () => {
      await provider.set('key1', 'value1', 'testCases');
      await provider.set('key2', 'value2', 'steps');
      
      const exported = await provider.export();
      const parsed = JSON.parse(exported);
      
      expect(parsed.version).toBe(1);
      expect(parsed.data.testCases).toBeDefined();
      expect(parsed.data.steps).toBeDefined();
    });
    
    it('should import data', async () => {
      const data = JSON.stringify({
        version: 1,
        exportedAt: Date.now(),
        data: {
          testCases: [{ key: 'imported', value: 'data' }],
        },
      });
      
      const result = await provider.import(data);
      
      expect(result.imported).toBe(1);
      expect(await provider.get('imported', 'testCases')).toBe('data');
    });
    
    it('should merge on import by default', async () => {
      await provider.set('existing', 'old', 'testCases');
      
      const data = JSON.stringify({
        version: 1,
        exportedAt: Date.now(),
        data: {
          testCases: [{ key: 'existing', value: 'new' }],
        },
      });
      
      await provider.import(data, true);
      
      expect(await provider.get('existing', 'testCases')).toBe('new');
    });
  });
  
  describe('quota and stats', () => {
    it('should return quota info', async () => {
      const quota = await provider.getQuota();
      
      expect(quota.total).toBeGreaterThan(0);
      expect(quota.available).toBeLessThanOrEqual(quota.total);
      expect(quota.usagePercent).toBeGreaterThanOrEqual(0);
    });
    
    it('should return stats', async () => {
      await provider.set('a', 1, 'testCases');
      await provider.set('b', 2, 'steps');
      
      const stats = await provider.getStats();
      
      expect(stats.itemCount).toBe(2);
      expect(stats.countByArea.testCases).toBe(1);
      expect(stats.countByArea.steps).toBe(1);
    });
  });
  
  describe('utility methods', () => {
    it('should get with metadata', async () => {
      await provider.set('key', 'value');
      
      const entry = await provider.getWithMetadata('key');
      
      expect(entry).not.toBeNull();
      expect(entry?.value).toBe('value');
      expect(entry?.metadata?.createdAt).toBeDefined();
    });
    
    it('should get entries', async () => {
      await provider.set('a', 1);
      await provider.set('b', 2);
      
      const entries = await provider.entries();
      
      expect(entries.length).toBe(2);
      expect(entries.some(e => e.key === 'a' && e.value === 1)).toBe(true);
    });
    
    it('should clear all areas', async () => {
      await provider.set('a', 1, 'testCases');
      await provider.set('b', 2, 'steps');
      await provider.set('c', 3, 'config');
      
      const cleared = await provider.clearAll();
      
      expect(cleared).toBe(3);
      expect(await provider.count()).toBe(0);
    });
  });
});
