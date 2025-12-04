/**
 * Tests for ServiceWorkerManager
 * @module background/ServiceWorkerManager.test
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  ServiceWorkerManager,
  createServiceWorkerManager,
  type IChromeAlarms,
  type IChromeRuntime,
  type INavigatorStorage,
  type ServiceWorkerEvent,
} from './ServiceWorkerManager';
import { BackgroundConfig } from './BackgroundConfig';
import type { IBackgroundState } from './IBackgroundService';

// ============================================================================
// MOCK FACTORIES
// ============================================================================

function createMockAlarms(): IChromeAlarms {
  const alarms = new Map<string, chrome.alarms.Alarm>();
  const listeners: Array<(alarm: chrome.alarms.Alarm) => void> = [];

  return {
    create: vi.fn((name, alarmInfo) => {
      alarms.set(name, {
        name,
        scheduledTime: Date.now(),
        periodInMinutes: alarmInfo.periodInMinutes,
      });
    }),
    clear: vi.fn(async (name) => alarms.delete(name)),
    get: vi.fn(async (name) => alarms.get(name)),
    onAlarm: {
      addListener: vi.fn((callback) => listeners.push(callback)),
      removeListener: vi.fn((callback) => {
        const index = listeners.indexOf(callback);
        if (index >= 0) listeners.splice(index, 1);
      }),
    },
    // Expose for testing
    _triggerAlarm: (name: string) => {
      const alarm = alarms.get(name);
      if (alarm) {
        listeners.forEach(l => l(alarm));
      }
    },
  } as IChromeAlarms & { _triggerAlarm: (name: string) => void };
}

function createMockRuntime(): IChromeRuntime {
  const installListeners: Array<(details: chrome.runtime.InstalledDetails) => void> = [];
  const startupListeners: Array<() => void> = [];
  const suspendListeners: Array<() => void> = [];

  return {
    onInstalled: {
      addListener: vi.fn((callback) => installListeners.push(callback)),
      removeListener: vi.fn((callback) => {
        const index = installListeners.indexOf(callback);
        if (index >= 0) installListeners.splice(index, 1);
      }),
    },
    onStartup: {
      addListener: vi.fn((callback) => startupListeners.push(callback)),
      removeListener: vi.fn((callback) => {
        const index = startupListeners.indexOf(callback);
        if (index >= 0) startupListeners.splice(index, 1);
      }),
    },
    onSuspend: {
      addListener: vi.fn((callback) => suspendListeners.push(callback)),
      removeListener: vi.fn((callback) => {
        const index = suspendListeners.indexOf(callback);
        if (index >= 0) suspendListeners.splice(index, 1);
      }),
    },
    getURL: vi.fn((path) => `chrome-extension://test/${path}`),
    // Expose for testing
    _triggerInstall: (details: chrome.runtime.InstalledDetails) => {
      installListeners.forEach(l => l(details));
    },
    _triggerStartup: () => {
      startupListeners.forEach(l => l());
    },
    _triggerSuspend: () => {
      suspendListeners.forEach(l => l());
    },
  } as IChromeRuntime & {
    _triggerInstall: (details: chrome.runtime.InstalledDetails) => void;
    _triggerStartup: () => void;
    _triggerSuspend: () => void;
  };
}

function createMockStorage(): INavigatorStorage {
  return {
    persist: vi.fn().mockResolvedValue(true),
    persisted: vi.fn().mockResolvedValue(true),
  };
}

function createMockStateManager(): IBackgroundState {
  return {
    save: vi.fn().mockResolvedValue(undefined),
    load: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    restore: vi.fn().mockResolvedValue(undefined),
    keys: vi.fn().mockResolvedValue([]),
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('ServiceWorkerManager', () => {
  let manager: ServiceWorkerManager;
  let config: BackgroundConfig;
  let mockAlarms: IChromeAlarms & { _triggerAlarm: (name: string) => void };
  let mockRuntime: IChromeRuntime & { _triggerInstall: any; _triggerStartup: any; _triggerSuspend: any };
  let mockStorage: INavigatorStorage;
  let mockStateManager: IBackgroundState;

  beforeEach(() => {
    config = new BackgroundConfig();
    mockAlarms = createMockAlarms() as any;
    mockRuntime = createMockRuntime() as any;
    mockStorage = createMockStorage();
    mockStateManager = createMockStateManager();

    manager = new ServiceWorkerManager(
      config,
      mockStateManager,
      mockAlarms,
      mockRuntime,
      mockStorage
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // STARTUP TESTS
  // ==========================================================================

  describe('startup', () => {
    it('should initialize successfully', async () => {
      const result = await manager.startup();

      expect(result.success).toBe(true);
      expect(result.status).toBe('ready');
      expect(manager.getStatus()).toBe('ready');
    });

    it('should restore state when configured', async () => {
      await manager.startup();

      expect(mockStateManager.restore).toHaveBeenCalled();
    });

    it('should request persistent storage when configured', async () => {
      await manager.startup();

      expect(mockStorage.persist).toHaveBeenCalled();
    });

    it('should start keepalive when configured', async () => {
      await manager.startup();

      expect(mockAlarms.create).toHaveBeenCalledWith(
        'sw-keepalive',
        { periodInMinutes: 0.5 }
      );
    });

    it('should not start keepalive when disabled', async () => {
      config.updateKeepalive({ enabled: false });
      await manager.startup();

      expect(mockAlarms.create).not.toHaveBeenCalled();
    });

    it('should setup Chrome listeners', async () => {
      await manager.startup();

      expect(mockAlarms.onAlarm.addListener).toHaveBeenCalled();
      expect(mockRuntime.onInstalled.addListener).toHaveBeenCalled();
      expect(mockRuntime.onStartup.addListener).toHaveBeenCalled();
      expect(mockRuntime.onSuspend.addListener).toHaveBeenCalled();
    });

    it('should emit startup events', async () => {
      const events: ServiceWorkerEvent[] = [];
      manager.onEvent(e => events.push(e));

      await manager.startup();

      expect(events.some(e => e.type === 'startup_started')).toBe(true);
      expect(events.some(e => e.type === 'startup_completed')).toBe(true);
    });

    it('should report startup duration', async () => {
      const result = await manager.startup();

      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================================================
  // SHUTDOWN TESTS
  // ==========================================================================

  describe('shutdown', () => {
    beforeEach(async () => {
      await manager.startup();
    });

    it('should shutdown successfully', async () => {
      await manager.shutdown();

      expect(manager.getStatus()).toBe('shutdown');
    });

    it('should stop keepalive', async () => {
      await manager.shutdown();

      expect(mockAlarms.clear).toHaveBeenCalledWith('sw-keepalive');
    });

    it('should remove Chrome listeners', async () => {
      await manager.shutdown();

      expect(mockAlarms.onAlarm.removeListener).toHaveBeenCalled();
      expect(mockRuntime.onInstalled.removeListener).toHaveBeenCalled();
    });

    it('should emit shutdown events', async () => {
      const events: ServiceWorkerEvent[] = [];
      manager.onEvent(e => events.push(e));

      await manager.shutdown();

      expect(events.some(e => e.type === 'shutdown_started')).toBe(true);
      expect(events.some(e => e.type === 'shutdown_completed')).toBe(true);
    });
  });

  // ==========================================================================
  // KEEPALIVE TESTS
  // ==========================================================================

  describe('keepalive', () => {
    beforeEach(async () => {
      await manager.startup();
    });

    it('should create keepalive alarm', async () => {
      expect(mockAlarms.create).toHaveBeenCalledWith(
        'sw-keepalive',
        { periodInMinutes: 0.5 }
      );
    });

    it('should track keepalive as active', () => {
      expect(manager.isKeepaliveActive()).toBe(true);
    });

    it('should handle keepalive tick', () => {
      const events: ServiceWorkerEvent[] = [];
      manager.onEvent(e => events.push(e));

      mockAlarms._triggerAlarm('sw-keepalive');

      expect(events.some(e => e.type === 'keepalive_tick')).toBe(true);
    });

    it('should stop keepalive', async () => {
      await manager.stopKeepalive();

      expect(mockAlarms.clear).toHaveBeenCalledWith('sw-keepalive');
      expect(manager.isKeepaliveActive()).toBe(false);
    });

    it('should ignore non-keepalive alarms', () => {
      const events: ServiceWorkerEvent[] = [];
      manager.onEvent(e => events.push(e));

      // Trigger a different alarm
      (mockAlarms as any)._triggerAlarm('other-alarm');

      expect(events.filter(e => e.type === 'keepalive_tick').length).toBe(0);
    });
  });

  // ==========================================================================
  // HEALTH CHECK TESTS
  // ==========================================================================

  describe('health check', () => {
    it('should report healthy when ready', async () => {
      await manager.startup();

      const health = manager.checkHealth();

      expect(health.status).toBe('ready');
      expect(health.healthy).toBe(true);
    });

    it('should report unhealthy when uninitialized', () => {
      const health = manager.checkHealth();

      expect(health.status).toBe('uninitialized');
      expect(health.healthy).toBe(false);
    });

    it('should track uptime', async () => {
      await manager.startup();
      await new Promise(resolve => setTimeout(resolve, 50));

      const health = manager.checkHealth();

      expect(health.uptime).toBeGreaterThanOrEqual(50);
    });

    it('should track keepalive status', async () => {
      await manager.startup();

      const health = manager.checkHealth();

      expect(health.keepaliveActive).toBe(true);
    });

    it('should emit health check event', async () => {
      await manager.startup();
      const events: ServiceWorkerEvent[] = [];
      manager.onEvent(e => events.push(e));

      manager.checkHealth();

      expect(events.some(e => e.type === 'health_check')).toBe(true);
    });
  });

  // ==========================================================================
  // LIFECYCLE EVENT TESTS
  // ==========================================================================

  describe('lifecycle events', () => {
    beforeEach(async () => {
      await manager.startup();
    });

    it('should emit installed event', () => {
      const events: string[] = [];
      manager.onLifecycle((event) => events.push(event));

      mockRuntime._triggerInstall({ reason: 'install' });

      expect(events).toContain('installed');
    });

    it('should emit updated event', () => {
      const events: string[] = [];
      manager.onLifecycle((event) => events.push(event));

      mockRuntime._triggerInstall({ reason: 'update', previousVersion: '1.0.0' });

      expect(events).toContain('updated');
    });

    it('should emit startup event', () => {
      const events: string[] = [];
      manager.onLifecycle((event) => events.push(event));

      mockRuntime._triggerStartup();

      expect(events).toContain('startup');
    });

    it('should emit suspend event and update status', () => {
      const events: string[] = [];
      manager.onLifecycle((event) => events.push(event));

      mockRuntime._triggerSuspend();

      expect(events).toContain('suspend');
      expect(manager.getStatus()).toBe('suspended');
    });
  });

  // ==========================================================================
  // STATE QUERIES
  // ==========================================================================

  describe('state queries', () => {
    it('should return uninitialized status initially', () => {
      expect(manager.getStatus()).toBe('uninitialized');
    });

    it('should return ready status after startup', async () => {
      await manager.startup();
      expect(manager.getStatus()).toBe('ready');
    });

    it('should report isReady correctly', async () => {
      expect(manager.isReady()).toBe(false);
      await manager.startup();
      expect(manager.isReady()).toBe(true);
    });

    it('should track uptime', async () => {
      expect(manager.getUptime()).toBe(0);
      await manager.startup();
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(manager.getUptime()).toBeGreaterThanOrEqual(10);
    });
  });

  // ==========================================================================
  // EVENT SUBSCRIPTION TESTS
  // ==========================================================================

  describe('event subscription', () => {
    it('should subscribe to events', async () => {
      const events: ServiceWorkerEvent[] = [];
      manager.onEvent(e => events.push(e));

      await manager.startup();

      expect(events.length).toBeGreaterThan(0);
    });

    it('should unsubscribe from events', async () => {
      const events: ServiceWorkerEvent[] = [];
      const unsubscribe = manager.onEvent(e => events.push(e));

      unsubscribe();
      await manager.startup();

      expect(events.length).toBe(0);
    });

    it('should subscribe to lifecycle events', async () => {
      await manager.startup();
      const events: string[] = [];
      manager.onLifecycle((event) => events.push(event));

      mockRuntime._triggerInstall({ reason: 'install' });

      expect(events).toContain('installed');
    });
  });
});

// ============================================================================
// FACTORY FUNCTION TESTS
// ============================================================================

describe('createServiceWorkerManager', () => {
  it('should create instance', () => {
    const config = new BackgroundConfig();
    const manager = createServiceWorkerManager(config);

    expect(manager).toBeInstanceOf(ServiceWorkerManager);
  });
});
