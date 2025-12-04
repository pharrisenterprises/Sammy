/**
 * Tests for ServiceCoordinator
 * @module background/ServiceCoordinator.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ServiceCoordinator,
  createServiceCoordinator,
  DEFAULT_COORDINATOR_CONFIG,
  type IServiceComponent,
  type IHandlerRegistry,
  type ILifecycleManager,
  type INavigationManager,
  type IStateManager,
  type CoordinatorEvent,
} from './ServiceCoordinator';
import { BackgroundConfig } from './BackgroundConfig';
import { MessageReceiver } from './MessageReceiver';

// ============================================================================
// MOCK FACTORIES
// ============================================================================

function createMockMessageReceiver(): MessageReceiver {
  const config = new BackgroundConfig();
  return new MessageReceiver(config);
}

function createMockStateManager(): IStateManager {
  return {
    save: vi.fn(async () => {}),
    load: vi.fn(async () => undefined),
    restore: vi.fn(async () => {}),
    saveSnapshot: vi.fn(async () => {}),
    loadSnapshot: vi.fn(async () => null),
    getStats: vi.fn(() => ({ saves: 0, loads: 0, restores: 0, errors: 0 })),
  };
}

function createMockLifecycleManager(): ILifecycleManager {
  const installHandlers: Array<(details: unknown) => void | Promise<void>> = [];
  const startupHandlers: Array<() => void | Promise<void>> = [];

  return {
    name: 'lifecycle-manager',
    start: vi.fn(async () => {}),
    stop: vi.fn(async () => {}),
    isActive: vi.fn(() => true),
    getStats: vi.fn(() => ({ installs: 0, updates: 0, startups: 0 })),
    onInstall: vi.fn((handler) => {
      installHandlers.push(handler);
      return () => {
        const idx = installHandlers.indexOf(handler);
        if (idx >= 0) installHandlers.splice(idx, 1);
      };
    }),
    onStartup: vi.fn((handler) => {
      startupHandlers.push(handler);
      return () => {
        const idx = startupHandlers.indexOf(handler);
        if (idx >= 0) startupHandlers.splice(idx, 1);
      };
    }),
    isFreshInstall: vi.fn(() => false),
    isUpdate: vi.fn(() => false),
    getVersion: vi.fn(() => '1.0.0'),
  };
}

function createMockNavigationManager(): INavigationManager {
  return {
    name: 'navigation-manager',
    start: vi.fn(async () => {}),
    stop: vi.fn(async () => {}),
    isActive: vi.fn(() => true),
    getStats: vi.fn(() => ({ navigationsDetected: 0 })),
    trackTab: vi.fn(),
    untrackTab: vi.fn(),
    setTrackedTabs: vi.fn(),
    setInjectionCallback: vi.fn(),
    setTabRemovedCallback: vi.fn(),
  };
}

function createMockHandlerRegistry(): IHandlerRegistry {
  return {
    registerAll: vi.fn(),
    getStats: vi.fn(() => ({ handled: 0 })),
  };
}

function createMockComponent(name: string): IServiceComponent {
  return {
    name,
    start: vi.fn(async () => {}),
    stop: vi.fn(async () => {}),
    isActive: vi.fn(() => true),
    getStats: vi.fn(() => ({ operations: 0 })),
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('ServiceCoordinator', () => {
  let coordinator: ServiceCoordinator;
  let config: BackgroundConfig;
  let messageReceiver: MessageReceiver;
  let stateManager: IStateManager;
  let lifecycleManager: ILifecycleManager;
  let navigationManager: INavigationManager;

  beforeEach(() => {
    config = new BackgroundConfig();
    messageReceiver = createMockMessageReceiver();
    stateManager = createMockStateManager();
    lifecycleManager = createMockLifecycleManager();
    navigationManager = createMockNavigationManager();

    coordinator = new ServiceCoordinator(
      config,
      {
        messageReceiver,
        stateManager,
        lifecycleManager,
        navigationManager,
      },
      { healthCheckInterval: 0 } // Disable health checks in tests
    );

    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (coordinator.isRunning()) {
      await coordinator.stop();
    }
  });

  // ==========================================================================
  // INITIALIZATION TESTS
  // ==========================================================================

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      const result = await coordinator.initialize();

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(coordinator.getStatus()).toBe('ready');
    });

    it('should restore state if configured', async () => {
      await coordinator.initialize();

      expect(stateManager.restore).toHaveBeenCalled();
    });

    it('should register handlers', async () => {
      const registry = createMockHandlerRegistry();
      coordinator.registerHandlers(registry);

      await coordinator.initialize();

      expect(registry.registerAll).toHaveBeenCalledWith(messageReceiver);
    });

    it('should setup lifecycle callbacks', async () => {
      await coordinator.initialize();

      expect(lifecycleManager.onInstall).toHaveBeenCalled();
      expect(lifecycleManager.onStartup).toHaveBeenCalled();
    });

    it('should track initialization statistics', async () => {
      await coordinator.initialize();

      expect(coordinator.getStats().initializations).toBe(1);
    });
  });

  // ==========================================================================
  // START/STOP TESTS
  // ==========================================================================

  describe('start', () => {
    beforeEach(async () => {
      await coordinator.initialize();
    });

    it('should start service', async () => {
      await coordinator.start();

      expect(coordinator.isRunning()).toBe(true);
      expect(coordinator.getStatus()).toBe('running');
    });

    it('should start lifecycle manager', async () => {
      await coordinator.start();

      expect(lifecycleManager.start).toHaveBeenCalled();
    });

    it('should start navigation manager', async () => {
      await coordinator.start();

      expect(navigationManager.start).toHaveBeenCalled();
    });

    it('should start additional components', async () => {
      const component = createMockComponent('test-component');
      coordinator.addComponent(component);

      await coordinator.start();

      expect(component.start).toHaveBeenCalled();
    });

    it('should throw if not initialized', async () => {
      const freshCoordinator = new ServiceCoordinator(config, {});

      await expect(freshCoordinator.start()).rejects.toThrow('Cannot start');
    });
  });

  describe('stop', () => {
    beforeEach(async () => {
      await coordinator.initialize();
      await coordinator.start();
    });

    it('should stop service', async () => {
      const result = await coordinator.stop();

      expect(result.success).toBe(true);
      expect(coordinator.getStatus()).toBe('stopped');
    });

    it('should save state snapshot', async () => {
      await coordinator.stop();

      expect(stateManager.saveSnapshot).toHaveBeenCalled();
    });

    it('should stop all components', async () => {
      await coordinator.stop();

      expect(lifecycleManager.stop).toHaveBeenCalled();
      expect(navigationManager.stop).toHaveBeenCalled();
    });

    it('should track shutdown statistics', async () => {
      await coordinator.stop();

      expect(coordinator.getStats().shutdowns).toBe(1);
    });
  });

  describe('restart', () => {
    beforeEach(async () => {
      await coordinator.initialize();
      await coordinator.start();
    });

    it('should restart service', async () => {
      await coordinator.restart();

      expect(coordinator.isRunning()).toBe(true);
    });
  });

  // ==========================================================================
  // COMPONENT MANAGEMENT TESTS
  // ==========================================================================

  describe('component management', () => {
    it('should add component', () => {
      const component = createMockComponent('test');
      coordinator.addComponent(component);

      expect(coordinator.getComponent('test')).toBe(component);
    });

    it('should start component if service running', async () => {
      await coordinator.initialize();
      await coordinator.start();

      const component = createMockComponent('late-component');
      coordinator.addComponent(component);

      expect(component.start).toHaveBeenCalled();
    });

    it('should remove component', async () => {
      await coordinator.initialize();
      await coordinator.start();

      const component = createMockComponent('test');
      coordinator.addComponent(component);
      coordinator.removeComponent('test');

      expect(coordinator.getComponent('test')).toBeUndefined();
      expect(component.stop).toHaveBeenCalled();
    });

    it('should get component names', () => {
      coordinator.addComponent(createMockComponent('comp1'));
      coordinator.addComponent(createMockComponent('comp2'));

      const names = coordinator.getComponentNames();

      expect(names).toContain('comp1');
      expect(names).toContain('comp2');
    });
  });

  // ==========================================================================
  // HEALTH MONITORING TESTS
  // ==========================================================================

  describe('getHealth', () => {
    beforeEach(async () => {
      await coordinator.initialize();
      await coordinator.start();
    });

    it('should return health info', () => {
      const health = coordinator.getHealth();

      expect(health.status).toBe('running');
      expect(health.uptime).toBeGreaterThanOrEqual(0);
      expect(health.components.length).toBeGreaterThan(0);
    });

    it('should include component statuses', () => {
      const component = createMockComponent('test');
      coordinator.addComponent(component);

      const health = coordinator.getHealth();
      const testComponent = health.components.find(c => c.name === 'test');

      expect(testComponent).toBeDefined();
      expect(testComponent?.status).toBe('active');
    });
  });

  // ==========================================================================
  // EVENT TESTS
  // ==========================================================================

  describe('events', () => {
    it('should emit initialized event', async () => {
      const events: CoordinatorEvent[] = [];
      coordinator.onEvent(e => events.push(e));

      await coordinator.initialize();

      expect(events.some(e => e.type === 'initialized')).toBe(true);
    });

    it('should emit started event', async () => {
      await coordinator.initialize();

      const events: CoordinatorEvent[] = [];
      coordinator.onEvent(e => events.push(e));

      await coordinator.start();

      expect(events.some(e => e.type === 'started')).toBe(true);
    });

    it('should emit component_started events', async () => {
      await coordinator.initialize();

      const events: CoordinatorEvent[] = [];
      coordinator.onEvent(e => events.push(e));

      await coordinator.start();

      expect(events.some(e => e.type === 'component_started')).toBe(true);
    });

    it('should unsubscribe from events', async () => {
      const events: CoordinatorEvent[] = [];
      const unsubscribe = coordinator.onEvent(e => events.push(e));

      unsubscribe();

      await coordinator.initialize();

      expect(events).toHaveLength(0);
    });
  });

  // ==========================================================================
  // DEPENDENCY INJECTION TESTS
  // ==========================================================================

  describe('dependency injection', () => {
    it('should set message receiver', () => {
      const freshCoordinator = new ServiceCoordinator(config, {});
      const receiver = createMockMessageReceiver();

      freshCoordinator.setMessageReceiver(receiver);

      expect(freshCoordinator.getMessageReceiver()).toBe(receiver);
    });

    it('should set state manager', () => {
      const freshCoordinator = new ServiceCoordinator(config, {});
      const manager = createMockStateManager();

      freshCoordinator.setStateManager(manager);

      expect(freshCoordinator.getStateManager()).toBe(manager);
    });

    it('should register handlers when running', async () => {
      await coordinator.initialize();
      await coordinator.start();

      const registry = createMockHandlerRegistry();
      coordinator.registerHandlers(registry);

      expect(registry.registerAll).toHaveBeenCalledWith(messageReceiver);
    });
  });

  // ==========================================================================
  // STATUS TESTS
  // ==========================================================================

  describe('status', () => {
    it('should start uninitialized', () => {
      const freshCoordinator = new ServiceCoordinator(config, {});
      expect(freshCoordinator.getStatus()).toBe('uninitialized');
    });

    it('should be ready after initialize', async () => {
      await coordinator.initialize();
      expect(coordinator.isReady()).toBe(true);
    });

    it('should track init errors', async () => {
      const badStateManager = createMockStateManager();
      vi.mocked(badStateManager.restore).mockRejectedValue(new Error('Restore failed'));

      const coordWithError = new ServiceCoordinator(
        config,
        { stateManager: badStateManager },
        { healthCheckInterval: 0 }
      );

      await coordWithError.initialize();

      expect(coordWithError.getInitErrors().length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // STATISTICS TESTS
  // ==========================================================================

  describe('statistics', () => {
    it('should reset statistics', async () => {
      await coordinator.initialize();

      coordinator.resetStats();

      expect(coordinator.getStats().initializations).toBe(0);
    });

    it('should record activity', () => {
      coordinator.recordActivity();

      const health = coordinator.getHealth();
      expect(health.lastActivity).not.toBeNull();
    });
  });
});

// ============================================================================
// FACTORY FUNCTION TESTS
// ============================================================================

describe('createServiceCoordinator', () => {
  it('should create instance', () => {
    const config = new BackgroundConfig();
    const coordinator = createServiceCoordinator(config);

    expect(coordinator).toBeInstanceOf(ServiceCoordinator);
  });

  it('should accept dependencies', () => {
    const config = new BackgroundConfig();
    const stateManager = createMockStateManager();

    const coordinator = createServiceCoordinator(config, { stateManager });

    expect(coordinator.getStateManager()).toBe(stateManager);
  });
});
