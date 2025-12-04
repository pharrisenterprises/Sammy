/**
 * Tests for BackgroundEntry
 * @module background/BackgroundEntry.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  BackgroundBootstrap,
  bootstrapBackground,
  getBackgroundCoordinator,
  isBackgroundInitialized,
  ensurePersistentStorage,
  DEFAULT_BOOTSTRAP_CONFIG,
  type IChromeAPIs,
} from './BackgroundEntry';

// ============================================================================
// MOCKS
// ============================================================================

// Mock navigator.storage
const mockNavigatorStorage = {
  persisted: vi.fn(async () => false),
  persist: vi.fn(async () => true),
};

// Mock chrome APIs
function createMockChromeAPIs(): Partial<IChromeAPIs> {
  return {
    runtime: {
      id: 'test-extension-id',
      getURL: vi.fn((path: string) => `chrome-extension://test/${path}`),
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
        hasListener: vi.fn(),
        hasListeners: vi.fn(),
      },
      onInstalled: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
        hasListener: vi.fn(),
        hasListeners: vi.fn(),
      },
      onStartup: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
        hasListener: vi.fn(),
        hasListeners: vi.fn(),
      },
    } as unknown as typeof chrome.runtime,
    tabs: {
      create: vi.fn(),
      remove: vi.fn(),
      get: vi.fn(),
      query: vi.fn(),
      sendMessage: vi.fn(),
      onRemoved: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    } as unknown as typeof chrome.tabs,
    action: {
      onClicked: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    } as unknown as typeof chrome.action,
    webNavigation: {
      onCommitted: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
      onCompleted: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    } as unknown as typeof chrome.webNavigation,
    scripting: {
      executeScript: vi.fn(),
    } as unknown as typeof chrome.scripting,
    storage: {
      local: {
        get: vi.fn((keys) => {
          // Return promise with empty result for all keys
          return Promise.resolve({});
        }),
        set: vi.fn((items) => {
          return Promise.resolve();
        }),
      },
    } as unknown as typeof chrome.storage,
  };
}

// Setup global mocks
beforeEach(() => {
  // Mock navigator.storage
  Object.defineProperty(global, 'navigator', {
    value: { storage: mockNavigatorStorage },
    writable: true,
  });

  vi.clearAllMocks();
});

afterEach(async () => {
  await BackgroundBootstrap.reset();
});

// ============================================================================
// TESTS
// ============================================================================

describe('ensurePersistentStorage', () => {
  it('should request persistence if not already persisted', async () => {
    mockNavigatorStorage.persisted.mockResolvedValue(false);
    mockNavigatorStorage.persist.mockResolvedValue(true);

    const result = await ensurePersistentStorage();

    expect(result).toBe(true);
    expect(mockNavigatorStorage.persisted).toHaveBeenCalled();
    expect(mockNavigatorStorage.persist).toHaveBeenCalled();
  });

  it('should return true if already persisted', async () => {
    mockNavigatorStorage.persisted.mockResolvedValue(true);

    const result = await ensurePersistentStorage();

    expect(result).toBe(true);
    expect(mockNavigatorStorage.persist).not.toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    mockNavigatorStorage.persisted.mockRejectedValue(new Error('Storage error'));

    const result = await ensurePersistentStorage();

    expect(result).toBe(false);
  });
});

describe('BackgroundBootstrap', () => {
  describe('bootstrap', () => {
    it('should bootstrap successfully', async () => {
      const mockAPIs = createMockChromeAPIs();
      const bootstrap = new BackgroundBootstrap(
        { autoStart: false, requestPersistence: false },
        mockAPIs
      );

      const result = await bootstrap.run();

      expect(result.success).toBe(true);
      expect(result.coordinator).not.toBeNull();
      expect(result.errors).toHaveLength(0);
    });

    it('should create all components', async () => {
      const mockAPIs = createMockChromeAPIs();
      const bootstrap = new BackgroundBootstrap(
        { autoStart: false, requestPersistence: false },
        mockAPIs
      );

      await bootstrap.run();

      expect(bootstrap.getMessageReceiver()).not.toBeNull();
      expect(bootstrap.getStateManager()).not.toBeNull();
      expect(bootstrap.getNavigationManager()).not.toBeNull();
      expect(bootstrap.getLifecycleManager()).not.toBeNull();
      expect(bootstrap.getCoordinator()).not.toBeNull();
    });

    it('should skip persistence request if disabled', async () => {
      const mockAPIs = createMockChromeAPIs();
      const bootstrap = new BackgroundBootstrap(
        { requestPersistence: false, autoStart: false },
        mockAPIs
      );

      await bootstrap.run();

      expect(mockNavigatorStorage.persist).not.toHaveBeenCalled();
    });

    it('should start service if autoStart enabled', async () => {
      const mockAPIs = createMockChromeAPIs();
      const bootstrap = new BackgroundBootstrap(
        { autoStart: true, requestPersistence: false },
        mockAPIs
      );

      const result = await bootstrap.run();
      const coordinator = result.coordinator;

      expect(coordinator?.isRunning()).toBe(true);
    });
  });

  describe('static methods', () => {
    it('should return same coordinator on multiple calls', async () => {
      const mockAPIs = createMockChromeAPIs();
      // Need to set chrome global for static calls
      (global as any).chrome = mockAPIs;

      const result1 = await BackgroundBootstrap.bootstrap({
        autoStart: false,
        requestPersistence: false,
      });
      const result2 = await BackgroundBootstrap.bootstrap();

      expect(result1.coordinator).toBe(result2.coordinator);

      delete (global as any).chrome;
    });

    it('should report initialized status', async () => {
      const mockAPIs = createMockChromeAPIs();
      (global as any).chrome = mockAPIs;

      expect(BackgroundBootstrap.isInitialized()).toBe(false);

      await BackgroundBootstrap.bootstrap({
        autoStart: false,
        requestPersistence: false,
      });

      expect(BackgroundBootstrap.isInitialized()).toBe(true);

      delete (global as any).chrome;
    });

    it('should get coordinator via static method', async () => {
      const mockAPIs = createMockChromeAPIs();
      (global as any).chrome = mockAPIs;

      await BackgroundBootstrap.bootstrap({
        autoStart: false,
        requestPersistence: false,
      });

      const coordinator = BackgroundBootstrap.getCoordinator();

      expect(coordinator).not.toBeNull();

      delete (global as any).chrome;
    });

    it('should reset bootstrap state', async () => {
      const mockAPIs = createMockChromeAPIs();
      (global as any).chrome = mockAPIs;

      await BackgroundBootstrap.bootstrap({
        autoStart: false,
        requestPersistence: false,
      });

      await BackgroundBootstrap.reset();

      expect(BackgroundBootstrap.isInitialized()).toBe(false);
      expect(BackgroundBootstrap.getCoordinator()).toBeNull();

      delete (global as any).chrome;
    });
  });

  describe('lifecycle callbacks', () => {
    it('should setup action click handler', async () => {
      const mockAPIs = createMockChromeAPIs();
      const bootstrap = new BackgroundBootstrap(
        { autoStart: false, requestPersistence: false },
        mockAPIs
      );

      await bootstrap.run();

      expect(mockAPIs.action?.onClicked.addListener).toHaveBeenCalled();
    });
  });
});

describe('bootstrapBackground', () => {
  it('should bootstrap via factory function', async () => {
    const mockAPIs = createMockChromeAPIs();
    (global as any).chrome = mockAPIs;

    const result = await bootstrapBackground({
      autoStart: false,
      requestPersistence: false,
    });

    expect(result.success).toBe(true);

    delete (global as any).chrome;
  });
});

describe('getBackgroundCoordinator', () => {
  it('should return null if not bootstrapped', () => {
    expect(getBackgroundCoordinator()).toBeNull();
  });

  it('should return coordinator after bootstrap', async () => {
    const mockAPIs = createMockChromeAPIs();
    (global as any).chrome = mockAPIs;

    await bootstrapBackground({
      autoStart: false,
      requestPersistence: false,
    });

    expect(getBackgroundCoordinator()).not.toBeNull();

    delete (global as any).chrome;
  });
});

describe('isBackgroundInitialized', () => {
  it('should return false initially', () => {
    expect(isBackgroundInitialized()).toBe(false);
  });

  it('should return true after bootstrap', async () => {
    const mockAPIs = createMockChromeAPIs();
    (global as any).chrome = mockAPIs;

    await bootstrapBackground({
      autoStart: false,
      requestPersistence: false,
    });

    expect(isBackgroundInitialized()).toBe(true);

    delete (global as any).chrome;
  });
});

describe('configuration', () => {
  it('should use default config', () => {
    expect(DEFAULT_BOOTSTRAP_CONFIG.autoStart).toBe(true);
    expect(DEFAULT_BOOTSTRAP_CONFIG.requestPersistence).toBe(true);
    expect(DEFAULT_BOOTSTRAP_CONFIG.openDashboardOnInstall).toBe(true);
  });

  it('should merge custom config', async () => {
    const bootstrap = new BackgroundBootstrap({
      autoStart: false,
      debug: true,
    });

    const config = bootstrap.getConfig();

    expect(config).toBeDefined();
  });
});
