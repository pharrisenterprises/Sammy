/**
 * ChromeStorageProvider Test Suite
 * @module core/storage/ChromeStorageProvider.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ChromeStorageProvider,
  createChromeStorage,
  getChromeStorage,
  resetChromeStorage,
  isChromeStorageAvailable,
  estimateJsonSize,
  CHROME_QUOTAS,
} from './ChromeStorageProvider';
import { MemoryStorageProvider } from './MemoryStorageProvider';

// ============================================================================
// CHROME API MOCK
// ============================================================================

/**
 * Creates a mock Chrome storage API
 */
function createMockChromeStorage() {
  const store: Record<string, unknown> = {};
  const listeners: Array<(changes: Record<string, chrome.storage.StorageChange>) => void> = [];
  
  return {
    store,
    get: vi.fn((keys: string | string[] | null, callback: (result: Record<string, unknown>) => void) => {
      const result: Record<string, unknown> = {};
      
      if (keys === null) {
        Object.assign(result, store);
      } else {
        const keyArray = Array.isArray(keys) ? keys : [keys];
        for (const key of keyArray) {
          if (key in store) {
            result[key] = store[key];
          }
        }
      }
      
      callback(result);
    }),
    set: vi.fn((items: Record<string, unknown>, callback: () => void) => {
      const changes: Record<string, chrome.storage.StorageChange> = {};
      
      for (const [key, value] of Object.entries(items)) {
        changes[key] = {
          oldValue: store[key],
          newValue: value,
        };
        store[key] = value;
      }
      
      callback();
      
      // Notify listeners
      for (const listener of listeners) {
        listener(changes);
      }
    }),
    remove: vi.fn((keys: string | string[], callback: () => void) => {
      const keyArray = Array.isArray(keys) ? keys : [keys];
      const changes: Record<string, chrome.storage.StorageChange> = {};
      
      for (const key of keyArray) {
        if (key in store) {
          changes[key] = { oldValue: store[key] };
          delete store[key];
        }
      }
      
      callback();
      
      for (const listener of listeners) {
        listener(changes);
      }
    }),
    clear: vi.fn((callback: () => void) => {
      const changes: Record<string, chrome.storage.StorageChange> = {};
      
      for (const key of Object.keys(store)) {
        changes[key] = { oldValue: store[key] };
        delete store[key];
      }
      
      callback();
      
      for (const listener of listeners) {
        listener(changes);
      }
    }),
    getBytesInUse: vi.fn((_keys: string | string[] | null, callback: (bytesInUse: number) => void) => {
      const size = JSON.stringify(store).length;
      callback(size);
    }),
    addListener: (listener: (changes: Record<string, chrome.storage.StorageChange>) => void) => {
      listeners.push(listener);
    },
    removeListener: (listener: (changes: Record<string, chrome.storage.StorageChange>) => void) => {
      const index = listeners.indexOf(listener);
      if (index >= 0) listeners.splice(index, 1);
    },
  };
}

/**
 * Sets up Chrome API mock globally
 */
function setupChromeMock() {
  const mockLocal = createMockChromeStorage();
  const mockSync = createMockChromeStorage();
  const mockSession = createMockChromeStorage();
  
  const onChanged = {
    listeners: [] as Array<(changes: Record<string, chrome.storage.StorageChange>, areaName: string) => void>,
    addListener: vi.fn((listener) => {
      onChanged.listeners.push(listener);
    }),
    removeListener: vi.fn((listener) => {
      const index = onChanged.listeners.indexOf(listener);
      if (index >= 0) onChanged.listeners.splice(index, 1);
    }),
  };
  
  (globalThis as Record<string, unknown>).chrome = {
    storage: {
      local: mockLocal,
      sync: mockSync,
      session: mockSession,
      onChanged,
    },
    runtime: {
      lastError: null,
    },
  };
  
  return { mockLocal, mockSync, mockSession, onChanged };
}

/**
 * Clears Chrome API mock
 */
function clearChromeMock() {
  delete (globalThis as Record<string, unknown>).chrome;
}

// ============================================================================
// HELPER FUNCTION TESTS
// ============================================================================

describe('isChromeStorageAvailable', () => {
  afterEach(() => {
    clearChromeMock();
  });
  
  it('should return false when chrome not defined', () => {
    expect(isChromeStorageAvailable()).toBe(false);
  });
  
  it('should return true when chrome.storage available', () => {
    setupChromeMock();
    expect(isChromeStorageAvailable()).toBe(true);
  });
});

describe('estimateJsonSize', () => {
  it('should estimate string size', () => {
    const size = estimateJsonSize('hello');
    expect(size).toBeGreaterThan(0);
  });
  
  it('should estimate object size', () => {
    const size = estimateJsonSize({ a: 1, b: 'test' });
    expect(size).toBeGreaterThan(0);
  });
  
  it('should return 0 for circular references', () => {
    const obj: Record<string, unknown> = { a: 1 };
    obj.self = obj;
    
    const size = estimateJsonSize(obj as never);
    expect(size).toBe(0);
  });
});

// ============================================================================
// PROVIDER TESTS WITH MOCK
// ============================================================================

describe('ChromeStorageProvider (with Chrome mock)', () => {
  let storage: ChromeStorageProvider;
  
  beforeEach(async () => {
    setupChromeMock();
    storage = createChromeStorage({
      chromeArea: 'local',
      namespace: 'test',
    });
    await storage.initialize();
  });
  
  afterEach(async () => {
    await storage.close();
    clearChromeMock();
  });
  
  describe('initialization', () => {
    it('should initialize correctly', () => {
      expect(storage.isReady).toBe(true);
      expect(storage.type).toBe('chrome-local');
    });
    
    it('should use correct Chrome area', () => {
      expect(storage.getChromeArea()).toBe('local');
    });
    
    it('should have namespace', () => {
      expect(storage.getNamespace()).toBe('test');
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
    
    it('should store complex objects', async () => {
      const obj = {
        name: 'test',
        values: [1, 2, 3],
        nested: { deep: true },
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
  });
  
  describe('metadata', () => {
    it('should store and retrieve metadata', async () => {
      await storage.setWithMetadata('key', 'value', {
        tags: ['important'],
        contentType: 'text/plain',
      });
      
      const entry = await storage.getWithMetadata('key');
      
      expect(entry?.metadata?.tags).toEqual(['important']);
      expect(entry?.metadata?.contentType).toBe('text/plain');
      expect(entry?.metadata?.createdAt).toBeDefined();
    });
  });
  
  describe('batch operations', () => {
    it('should get many values', async () => {
      await storage.set('a', 1);
      await storage.set('b', 2);
      
      const result = await storage.getMany(['a', 'b', 'c']);
      
      expect(result.get('a')).toBe(1);
      expect(result.get('b')).toBe(2);
      expect(result.has('c')).toBe(false);
    });
    
    it('should set many values', async () => {
      await storage.setMany([
        { key: 'a', value: 1 },
        { key: 'b', value: 2 },
      ]);
      
      expect(await storage.get('a')).toBe(1);
      expect(await storage.get('b')).toBe(2);
    });
    
    it('should remove many values', async () => {
      await storage.set('a', 1);
      await storage.set('b', 2);
      await storage.set('c', 3);
      
      const removed = await storage.removeMany(['a', 'c']);
      
      expect(removed).toBe(2);
      expect(await storage.has('b')).toBe(true);
    });
  });
  
  describe('query operations', () => {
    beforeEach(async () => {
      await storage.set('test-1', 'a');
      await storage.set('test-2', 'b');
      await storage.set('other-1', 'c');
    });
    
    it('should filter by prefix', async () => {
      const result = await storage.query({ prefix: 'test-' });
      
      expect(result.total).toBe(2);
    });
    
    it('should apply pagination', async () => {
      const page1 = await storage.query({ limit: 2 });
      
      expect(page1.entries.length).toBe(2);
      expect(page1.hasMore).toBe(true);
    });
  });
  
  describe('clear operations', () => {
    it('should clear specific area', async () => {
      await storage.set('a', 1, 'testCases');
      await storage.set('b', 2, 'steps');
      
      await storage.clear('testCases');
      
      expect(await storage.has('a', 'testCases')).toBe(false);
      expect(await storage.has('b', 'steps')).toBe(true);
    });
    
    it('should clear all in namespace', async () => {
      await storage.set('a', 1, 'testCases');
      await storage.set('b', 2, 'steps');
      
      const cleared = await storage.clearAll();
      
      expect(cleared).toBe(2);
    });
  });
  
  describe('quota', () => {
    it('should report quota', async () => {
      await storage.set('key', 'value');
      
      const quota = await storage.getQuota();
      
      expect(quota.total).toBe(CHROME_QUOTAS.local);
      expect(quota.used).toBeGreaterThan(0);
    });
  });
  
  describe('transactions', () => {
    it('should execute multiple operations', async () => {
      const result = await storage.transaction([
        { type: 'set', key: 'a', value: 1 },
        { type: 'set', key: 'b', value: 2 },
      ]);
      
      expect(result.success).toBe(true);
      expect(await storage.get('a')).toBe(1);
      expect(await storage.get('b')).toBe(2);
    });
  });
  
  describe('statistics', () => {
    it('should return stats', async () => {
      await storage.set('a', 1, 'testCases');
      await storage.set('b', 2, 'steps');
      
      const stats = await storage.getStats();
      
      expect(stats.itemCount).toBe(2);
      expect(stats.countByArea.testCases).toBe(1);
      expect(stats.countByArea.steps).toBe(1);
    });
  });
});

// ============================================================================
// FALLBACK TESTS
// ============================================================================

describe('ChromeStorageProvider (with fallback)', () => {
  let storage: ChromeStorageProvider;
  let fallback: MemoryStorageProvider;
  
  beforeEach(async () => {
    // Ensure no Chrome mock
    clearChromeMock();
    
    fallback = new MemoryStorageProvider();
    await fallback.initialize();
    
    storage = createChromeStorage({
      chromeArea: 'local',
      fallbackProvider: fallback,
    });
    await storage.initialize();
  });
  
  afterEach(async () => {
    await storage.close();
  });
  
  it('should use fallback when Chrome unavailable', () => {
    expect(storage.isFallbackActive()).toBe(true);
  });
  
  it('should perform CRUD via fallback', async () => {
    await storage.set('key', 'value');
    
    expect(await storage.get('key')).toBe('value');
    expect(await storage.has('key')).toBe(true);
    
    await storage.remove('key');
    expect(await storage.has('key')).toBe(false);
  });
  
  it('should query via fallback', async () => {
    await storage.set('test-1', 'a');
    await storage.set('test-2', 'b');
    
    const result = await storage.query({ prefix: 'test-' });
    
    expect(result.total).toBe(2);
  });
});

// ============================================================================
// SYNC STORAGE TESTS
// ============================================================================

describe('ChromeStorageProvider (sync)', () => {
  let storage: ChromeStorageProvider;
  
  beforeEach(async () => {
    setupChromeMock();
    storage = createChromeStorage({
      chromeArea: 'sync',
      namespace: 'test',
    });
    await storage.initialize();
  });
  
  afterEach(async () => {
    await storage.close();
    clearChromeMock();
  });
  
  it('should use sync storage', () => {
    expect(storage.type).toBe('chrome-sync');
    expect(storage.getChromeArea()).toBe('sync');
  });
  
  it('should report sync quota', async () => {
    const quota = await storage.getQuota();
    expect(quota.total).toBe(CHROME_QUOTAS.sync);
  });
});

// ============================================================================
// SINGLETON TESTS
// ============================================================================

describe('getChromeStorage (singleton)', () => {
  beforeEach(() => {
    setupChromeMock();
  });
  
  afterEach(async () => {
    await resetChromeStorage();
    clearChromeMock();
  });
  
  it('should return same instance for same area', () => {
    const instance1 = getChromeStorage('local');
    const instance2 = getChromeStorage('local');
    
    expect(instance1).toBe(instance2);
  });
  
  it('should return different instances for different areas', () => {
    const local = getChromeStorage('local');
    const sync = getChromeStorage('sync');
    
    expect(local).not.toBe(sync);
  });
  
  it('should reset on resetChromeStorage', async () => {
    const instance1 = getChromeStorage('local');
    await resetChromeStorage();
    const instance2 = getChromeStorage('local');
    
    expect(instance1).not.toBe(instance2);
  });
});

// ============================================================================
// ERROR HANDLING TESTS
// ============================================================================

describe('ChromeStorageProvider (error handling)', () => {
  it('should throw when Chrome unavailable and no fallback', async () => {
    clearChromeMock();
    
    const storage = createChromeStorage({ chromeArea: 'local' });
    
    await expect(storage.initialize()).rejects.toThrow(/not available/);
  });
});
