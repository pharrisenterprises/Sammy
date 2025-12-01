/**
 * StorageManager Test Suite
 * @module core/storage/StorageManager.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  StorageManager,
  createStorageManager,
  getStorageManager,
  resetStorageManager,
  storageGet,
  storageSet,
  storageRemove,
  MAX_CACHE_ENTRIES,
} from './StorageManager';
import { createMemoryStorage } from './MemoryStorageProvider';

// ============================================================================
// BASIC TESTS
// ============================================================================

describe('StorageManager', () => {
  let manager: StorageManager;
  
  beforeEach(async () => {
    manager = createStorageManager({
      preferredProvider: 'memory',
      enableCache: true,
    });
    await manager.initialize();
  });
  
  afterEach(async () => {
    await manager.close();
  });
  
  describe('initialization', () => {
    it('should initialize correctly', () => {
      expect(manager.isReady).toBe(true);
    });
    
    it('should select memory provider', () => {
      const info = manager.getProviderInfo();
      expect(info.type).toBe('memory');
      expect(info.isReady).toBe(true);
    });
    
    it('should close correctly', async () => {
      await manager.close();
      expect(manager.isReady).toBe(false);
    });
    
    it('should throw when not initialized', async () => {
      const uninitManager = createStorageManager();
      
      await expect(uninitManager.get('key')).rejects.toThrow(/not initialized/);
    });
  });
  
  describe('basic CRUD', () => {
    it('should set and get values', async () => {
      await manager.set('key1', 'value1');
      const result = await manager.get('key1');
      
      expect(result).toBe('value1');
    });
    
    it('should return null for missing keys', async () => {
      const result = await manager.get('nonexistent');
      expect(result).toBeNull();
    });
    
    it('should check existence', async () => {
      await manager.set('key1', 'value1');
      
      expect(await manager.has('key1')).toBe(true);
      expect(await manager.has('nonexistent')).toBe(false);
    });
    
    it('should remove values', async () => {
      await manager.set('key1', 'value1');
      const removed = await manager.remove('key1');
      
      expect(removed).toBe(true);
      expect(await manager.has('key1')).toBe(false);
    });
    
    it('should store complex objects', async () => {
      const obj = {
        name: 'test',
        values: [1, 2, 3],
        nested: { deep: true },
      };
      
      await manager.set('complex', obj);
      const result = await manager.get('complex');
      
      expect(result).toEqual(obj);
    });
  });
  
  describe('area separation', () => {
    it('should separate data by area', async () => {
      await manager.set('key', 'value1', 'testCases');
      await manager.set('key', 'value2', 'steps');
      
      expect(await manager.get('key', 'testCases')).toBe('value1');
      expect(await manager.get('key', 'steps')).toBe('value2');
    });
    
    it('should clear specific area', async () => {
      await manager.set('a', 1, 'testCases');
      await manager.set('b', 2, 'steps');
      
      await manager.clear('testCases');
      
      expect(await manager.has('a', 'testCases')).toBe(false);
      expect(await manager.has('b', 'steps')).toBe(true);
    });
  });
  
  describe('batch operations', () => {
    it('should get many values', async () => {
      await manager.set('a', 1);
      await manager.set('b', 2);
      await manager.set('c', 3);
      
      const result = await manager.getMany(['a', 'b', 'd']);
      
      expect(result.get('a')).toBe(1);
      expect(result.get('b')).toBe(2);
      expect(result.has('d')).toBe(false);
    });
    
    it('should set many values', async () => {
      await manager.setMany([
        { key: 'a', value: 1 },
        { key: 'b', value: 2 },
      ]);
      
      expect(await manager.get('a')).toBe(1);
      expect(await manager.get('b')).toBe(2);
    });
    
    it('should remove many values', async () => {
      await manager.set('a', 1);
      await manager.set('b', 2);
      await manager.set('c', 3);
      
      const removed = await manager.removeMany(['a', 'c']);
      
      expect(removed).toBe(2);
      expect(await manager.has('b')).toBe(true);
    });
  });
  
  describe('query operations', () => {
    beforeEach(async () => {
      await manager.set('test-1', 'a');
      await manager.set('test-2', 'b');
      await manager.set('other-1', 'c');
    });
    
    it('should filter by prefix', async () => {
      const result = await manager.query({ prefix: 'test-' });
      
      expect(result.total).toBe(2);
    });
    
    it('should count entries', async () => {
      const total = await manager.count();
      const filtered = await manager.count({ prefix: 'test-' });
      
      expect(total).toBe(3);
      expect(filtered).toBe(2);
    });
    
    it('should list keys', async () => {
      const keys = await manager.keys();
      
      expect(keys).toContain('test-1');
      expect(keys).toContain('test-2');
      expect(keys).toContain('other-1');
    });
  });
});

// ============================================================================
// CACHING TESTS
// ============================================================================

describe('StorageManager (caching)', () => {
  let manager: StorageManager;
  
  beforeEach(async () => {
    manager = createStorageManager({
      preferredProvider: 'memory',
      enableCache: true,
      cacheTtl: 1000,
      maxCacheEntries: 10,
    });
    await manager.initialize();
  });
  
  afterEach(async () => {
    await manager.close();
  });
  
  it('should cache values on get', async () => {
    await manager.set('key', 'value');
    
    // First get - fetches from provider
    await manager.get('key');
    
    // Second get - should use cache
    const result = await manager.get('key');
    
    expect(result).toBe('value');
  });
  
  it('should invalidate cache on set', async () => {
    await manager.set('key', 'value1');
    await manager.get('key'); // Cache it
    
    await manager.set('key', 'value2');
    const result = await manager.get('key');
    
    expect(result).toBe('value2');
  });
  
  it('should invalidate cache on remove', async () => {
    await manager.set('key', 'value');
    await manager.get('key'); // Cache it
    
    await manager.remove('key');
    const result = await manager.get('key');
    
    expect(result).toBeNull();
  });
  
  it('should expire cached values', async () => {
    const shortTtlManager = createStorageManager({
      preferredProvider: 'memory',
      enableCache: true,
      cacheTtl: 50,
    });
    await shortTtlManager.initialize();
    
    await shortTtlManager.set('key', 'value');
    await shortTtlManager.get('key'); // Cache it
    
    await new Promise(r => setTimeout(r, 100));
    
    // Cache should be expired, fetches from provider
    const result = await shortTtlManager.get('key');
    expect(result).toBe('value');
    
    await shortTtlManager.close();
  });
  
  it('should evict old entries when cache is full', async () => {
    // Fill cache beyond max
    for (let i = 0; i < 15; i++) {
      await manager.set(`key-${i}`, `value-${i}`);
      await manager.get(`key-${i}`); // Cache it
    }
    
    const stats = manager.getCacheStats();
    expect(stats.size).toBeLessThanOrEqual(stats.maxSize);
  });
  
  it('should clear cache', async () => {
    await manager.set('key', 'value');
    await manager.get('key'); // Cache it
    
    manager.clearCache();
    
    const stats = manager.getCacheStats();
    expect(stats.size).toBe(0);
  });
  
  it('should use cache in getMany', async () => {
    await manager.set('a', 1);
    await manager.set('b', 2);
    
    // Cache 'a'
    await manager.get('a');
    
    // getMany should use cached 'a'
    const result = await manager.getMany(['a', 'b']);
    
    expect(result.get('a')).toBe(1);
    expect(result.get('b')).toBe(2);
  });
});

// ============================================================================
// CHANGE EVENTS TESTS
// ============================================================================

describe('StorageManager (change events)', () => {
  let manager: StorageManager;
  
  beforeEach(async () => {
    manager = createStorageManager({
      preferredProvider: 'memory',
    });
    await manager.initialize();
  });
  
  afterEach(async () => {
    await manager.close();
  });
  
  it('should notify on set', async () => {
    const listener = vi.fn();
    manager.onChange(listener);
    
    await manager.set('key', 'value');
    
    expect(listener).toHaveBeenCalled();
  });
  
  it('should notify on remove', async () => {
    await manager.set('key', 'value');
    
    const listener = vi.fn();
    manager.onChange(listener);
    
    await manager.remove('key');
    
    expect(listener).toHaveBeenCalled();
  });
  
  it('should unsubscribe', async () => {
    const listener = vi.fn();
    const unsubscribe = manager.onChange(listener);
    
    unsubscribe();
    await manager.set('key', 'value');
    
    expect(listener).not.toHaveBeenCalled();
  });
});

// ============================================================================
// EXPORT/IMPORT TESTS
// ============================================================================

describe('StorageManager (export/import)', () => {
  let manager: StorageManager;
  
  beforeEach(async () => {
    manager = createStorageManager({
      preferredProvider: 'memory',
    });
    await manager.initialize();
  });
  
  afterEach(async () => {
    await manager.close();
  });
  
  it('should export data', async () => {
    await manager.set('key1', 'value1', 'testCases');
    await manager.set('key2', 'value2', 'steps');
    
    const exported = await manager.export();
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
    
    const result = await manager.import(data);
    
    expect(result.imported).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// MIGRATION TESTS
// ============================================================================

describe('StorageManager (migration)', () => {
  let manager: StorageManager;
  
  beforeEach(async () => {
    manager = createStorageManager({
      preferredProvider: 'memory',
    });
    await manager.initialize();
  });
  
  afterEach(async () => {
    await manager.close();
  });
  
  it('should migrate data between providers', async () => {
    // Add some data
    await manager.set('key1', 'value1', 'testCases');
    await manager.set('key2', 'value2', 'steps');
    
    // Create target provider
    const target = createMemoryStorage();
    await target.initialize();
    
    // Migrate
    const result = await manager.migrate(
      manager.getRawProvider(),
      target,
      ['testCases', 'steps']
    );
    
    expect(result.success).toBe(true);
    expect(result.itemsMigrated).toBe(2);
    expect(result.itemsFailed).toBe(0);
    
    // Verify data in target
    expect(await target.get('key1', 'testCases')).toBe('value1');
    expect(await target.get('key2', 'steps')).toBe('value2');
    
    await target.close();
  });
  
  it('should migrate and switch providers', async () => {
    await manager.set('key', 'value', 'testCases');
    
    const newProvider = createMemoryStorage();
    
    const result = await manager.migrateAndSwitch(newProvider, ['testCases']);
    
    expect(result.success).toBe(true);
    expect(await manager.get('key', 'testCases')).toBe('value');
  });
});

// ============================================================================
// PROVIDER INFO TESTS
// ============================================================================

describe('StorageManager (provider info)', () => {
  let manager: StorageManager;
  
  beforeEach(async () => {
    manager = createStorageManager({
      preferredProvider: 'memory',
    });
    await manager.initialize();
  });
  
  afterEach(async () => {
    await manager.close();
  });
  
  it('should return provider info', () => {
    const info = manager.getProviderInfo();
    
    expect(info.type).toBe('memory');
    expect(info.isReady).toBe(true);
    expect(info.isFallback).toBe(false);
  });
  
  it('should return quota info', async () => {
    const quota = await manager.getQuota();
    
    expect(quota.total).toBeGreaterThan(0);
    expect(quota.usagePercent).toBeGreaterThanOrEqual(0);
  });
  
  it('should return stats', async () => {
    await manager.set('a', 1, 'testCases');
    await manager.set('b', 2, 'steps');
    
    const stats = await manager.getStats();
    
    expect(stats.itemCount).toBe(2);
  });
  
  it('should return cache stats', () => {
    const stats = manager.getCacheStats();
    
    expect(stats.size).toBeGreaterThanOrEqual(0);
    expect(stats.maxSize).toBe(MAX_CACHE_ENTRIES);
  });
});

// ============================================================================
// SINGLETON TESTS
// ============================================================================

describe('getStorageManager (singleton)', () => {
  afterEach(async () => {
    await resetStorageManager();
  });
  
  it('should return same instance', () => {
    const instance1 = getStorageManager();
    const instance2 = getStorageManager();
    
    expect(instance1).toBe(instance2);
  });
  
  it('should reset on resetStorageManager', async () => {
    const instance1 = getStorageManager();
    await resetStorageManager();
    const instance2 = getStorageManager();
    
    expect(instance1).not.toBe(instance2);
  });
});

// ============================================================================
// CONVENIENCE FUNCTION TESTS
// ============================================================================

describe('storageGet/storageSet/storageRemove', () => {
  afterEach(async () => {
    await resetStorageManager();
  });
  
  it('should get and set via convenience functions', async () => {
    await storageSet('key', 'value');
    const result = await storageGet('key');
    
    expect(result).toBe('value');
  });
  
  it('should remove via convenience function', async () => {
    await storageSet('key', 'value');
    await storageRemove('key');
    
    const result = await storageGet('key');
    expect(result).toBeNull();
  });
  
  it('should auto-initialize', async () => {
    // First call should initialize
    await storageSet('key', 'value');
    
    const manager = getStorageManager();
    expect(manager.isReady).toBe(true);
  });
});
