/**
 * IndexedDB Mock
 * @module test/mocks/indexeddb
 * @version 1.0.0
 * 
 * Mocks IndexedDB for testing with in-memory storage.
 */

import { vi } from 'vitest';
import 'fake-indexeddb/auto';

// ============================================================================
// IN-MEMORY STORE
// ============================================================================

interface Store {
  data: Map<number | string, unknown>;
  keyPath: string;
  autoIncrement: boolean;
  currentId: number;
}

const databases: Map<string, Map<string, Store>> = new Map();

// ============================================================================
// DEXIE MOCK HELPERS
// ============================================================================

/**
 * Create a mock Dexie table
 */
export const createMockTable = <T extends { id?: number }>(
  initialData: T[] = []
): {
  data: Map<number, T>;
  toArray: () => Promise<T[]>;
  get: (id: number) => Promise<T | undefined>;
  add: (item: Omit<T, 'id'>) => Promise<number>;
  put: (item: T) => Promise<number>;
  update: (id: number, changes: Partial<T>) => Promise<number>;
  delete: (id: number) => Promise<void>;
  where: (field: string) => {
    equals: (value: unknown) => { toArray: () => Promise<T[]> };
  };
  clear: () => Promise<void>;
} => {
  const data = new Map<number, T>();
  let nextId = 1;

  // Initialize with data
  initialData.forEach((item) => {
    const id = item.id || nextId++;
    data.set(id, { ...item, id });
  });

  return {
    data,
    
    toArray: vi.fn(async () => Array.from(data.values())),
    
    get: vi.fn(async (id: number) => data.get(id)),
    
    add: vi.fn(async (item: Omit<T, 'id'>) => {
      const id = nextId++;
      data.set(id, { ...item, id } as T);
      return id;
    }),
    
    put: vi.fn(async (item: T) => {
      const id = item.id || nextId++;
      data.set(id, { ...item, id });
      return id;
    }),
    
    update: vi.fn(async (id: number, changes: Partial<T>) => {
      const existing = data.get(id);
      if (existing) {
        data.set(id, { ...existing, ...changes });
        return 1;
      }
      return 0;
    }),
    
    delete: vi.fn(async (id: number) => {
      data.delete(id);
    }),
    
    where: vi.fn((field: string) => ({
      equals: vi.fn((value: unknown) => ({
        toArray: vi.fn(async () => {
          return Array.from(data.values()).filter(
            (item) => (item as Record<string, unknown>)[field] === value
          );
        }),
      })),
    })),
    
    clear: vi.fn(async () => {
      data.clear();
      nextId = 1;
    }),
  };
};

// ============================================================================
// MOCK DB INSTANCE
// ============================================================================

export interface MockDB {
  projects: ReturnType<typeof createMockTable>;
  testRuns: ReturnType<typeof createMockTable>;
  open: () => Promise<MockDB>;
  close: () => void;
  delete: () => Promise<void>;
}

/**
 * Create a mock database instance
 */
export const createMockDB = (): MockDB => {
  return {
    projects: createMockTable(),
    testRuns: createMockTable(),
    open: vi.fn(async function(this: MockDB) { return this; }),
    close: vi.fn(),
    delete: vi.fn(async () => {}),
  };
};

// ============================================================================
// NAVIGATOR STORAGE MOCK
// ============================================================================

const mockNavigatorStorage = {
  persist: vi.fn(async () => true),
  persisted: vi.fn(async () => true),
  estimate: vi.fn(async () => ({
    quota: 1000000000,
    usage: 100000,
  })),
};

// Only mock if not already defined
if (typeof navigator !== 'undefined' && !navigator.storage) {
  Object.defineProperty(navigator, 'storage', {
    value: mockNavigatorStorage,
    writable: true,
    configurable: true,
  });
}

export { mockNavigatorStorage };
