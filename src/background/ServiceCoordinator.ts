/**
 * ServiceCoordinator - Central coordinator for background service components
 * @module background/ServiceCoordinator
 * @version 1.0.0
 * 
 * Coordinates all background service components:
 * - Manages startup/shutdown sequence
 * - Handles dependency injection
 * - Monitors service health
 * - Provides unified service interface
 * 
 * @see background-service_breakdown.md for architecture
 */

import type { BackgroundConfig } from './BackgroundConfig';
import type { MessageReceiver } from './MessageReceiver';
import type { IBackgroundState } from './BackgroundState';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Service status
 */
export type ServiceStatus = 
  | 'uninitialized'
  | 'initializing' 
  | 'ready'
  | 'running'
  | 'paused'
  | 'stopping'
  | 'stopped'
  | 'error';

/**
 * Component status
 */
export interface ComponentStatus {
  name: string;
  status: 'inactive' | 'active' | 'error';
  lastError?: string;
  startedAt?: Date;
  statistics?: Record<string, number>;
}

/**
 * Service health info
 */
export interface ServiceHealth {
  status: ServiceStatus;
  uptime: number;
  startedAt: Date | null;
  components: ComponentStatus[];
  memoryUsage?: number;
  lastActivity: Date | null;
}

/**
 * Initialization result
 */
export interface InitResult {
  success: boolean;
  duration: number;
  errors: string[];
  componentsInitialized: string[];
}

/**
 * Shutdown result
 */
export interface ShutdownResult {
  success: boolean;
  duration: number;
  errors: string[];
  componentsStopped: string[];
}

/**
 * Component interface
 */
export interface IServiceComponent {
  name: string;
  start(): Promise<void> | void;
  stop(): Promise<void> | void;
  isActive?(): boolean;
  getStats?(): Record<string, number>;
}

/**
 * Handler registry interface
 */
export interface IHandlerRegistry {
  registerAll(receiver: MessageReceiver): void;
  getStats?(): Record<string, number>;
}

/**
 * Lifecycle manager interface
 */
export interface ILifecycleManager extends IServiceComponent {
  onInstall(handler: (details: unknown) => void | Promise<void>): () => void;
  onStartup(handler: () => void | Promise<void>): () => void;
  isFreshInstall(): boolean;
  isUpdate(): boolean;
  getVersion(): string;
}

/**
 * Navigation manager interface
 */
export interface INavigationManager extends IServiceComponent {
  trackTab(tabId: number): void;
  untrackTab(tabId: number): void;
  setTrackedTabs(tabs: Set<number>): void;
  setInjectionCallback(callback: (tabId: number, allFrames: boolean) => Promise<boolean>): void;
  setTabRemovedCallback(callback: (tabId: number) => void): void;
}

/**
 * State manager interface
 */
export interface IStateManager {
  save<T>(key: string, value: T): Promise<void>;
  load<T>(key: string): Promise<T | undefined>;
  restore(): Promise<void>;
  saveSnapshot(): Promise<void>;
  loadSnapshot(): Promise<unknown | null>;
  getStats?(): { saves: number; loads: number; restores: number; errors: number };
}

/**
 * Service coordinator event types
 */
export type CoordinatorEventType =
  | 'initializing'
  | 'initialized'
  | 'starting'
  | 'started'
  | 'stopping'
  | 'stopped'
  | 'error'
  | 'component_started'
  | 'component_stopped'
  | 'component_error'
  | 'health_check';

/**
 * Service coordinator event
 */
export interface CoordinatorEvent {
  type: CoordinatorEventType;
  timestamp: Date;
  component?: string;
  error?: string;
  details?: Record<string, unknown>;
}

/**
 * Event listener
 */
export type CoordinatorEventListener = (event: CoordinatorEvent) => void;

/**
 * Coordinator configuration
 */
export interface CoordinatorConfig {
  autoStart: boolean;
  healthCheckInterval: number;
  shutdownTimeout: number;
  restoreStateOnStart: boolean;
  saveStateOnStop: boolean;
}

/**
 * Default coordinator config
 */
export const DEFAULT_COORDINATOR_CONFIG: CoordinatorConfig = {
  autoStart: true,
  healthCheckInterval: 60000, // 1 minute
  shutdownTimeout: 5000,
  restoreStateOnStart: true,
  saveStateOnStop: true,
};

// ============================================================================
// SERVICE COORDINATOR CLASS
// ============================================================================

/**
 * ServiceCoordinator - Central coordinator for background service
 * 
 * @example
 * ```typescript
 * const coordinator = new ServiceCoordinator(config, {
 *   messageReceiver,
 *   stateManager,
 *   lifecycleManager,
 *   navigationManager,
 * });
 * 
 * // Add handlers
 * coordinator.registerHandlers(projectHandlers);
 * coordinator.registerHandlers(testRunHandlers);
 * 
 * // Initialize and start
 * await coordinator.initialize();
 * await coordinator.start();
 * 
 * // Check health
 * const health = coordinator.getHealth();
 * ```
 */
export class ServiceCoordinator {
  private backgroundConfig: BackgroundConfig;
  private coordinatorConfig: CoordinatorConfig;

  // Core components
  private messageReceiver: MessageReceiver | null = null;
  private stateManager: IStateManager | null = null;
  private lifecycleManager: ILifecycleManager | null = null;
  private navigationManager: INavigationManager | null = null;

  // Handler registries
  private handlerRegistries: IHandlerRegistry[] = [];

  // Additional components
  private components: Map<string, IServiceComponent> = new Map();

  // Service state
  private status: ServiceStatus = 'uninitialized';
  private startedAt: Date | null = null;
  private lastActivity: Date | null = null;
  private initErrors: string[] = [];

  // Health check
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;

  // Event listeners
  private eventListeners: Set<CoordinatorEventListener> = new Set();

  // Statistics
  private stats = {
    initializations: 0,
    startups: 0,
    shutdowns: 0,
    healthChecks: 0,
    errors: 0,
  };

  /**
   * Create ServiceCoordinator
   */
  constructor(
    backgroundConfig: BackgroundConfig,
    dependencies: {
      messageReceiver?: MessageReceiver;
      stateManager?: IStateManager;
      lifecycleManager?: ILifecycleManager;
      navigationManager?: INavigationManager;
    } = {},
    coordinatorConfig: Partial<CoordinatorConfig> = {}
  ) {
    this.backgroundConfig = backgroundConfig;
    this.coordinatorConfig = { ...DEFAULT_COORDINATOR_CONFIG, ...coordinatorConfig };

    // Set core dependencies
    this.messageReceiver = dependencies.messageReceiver ?? null;
    this.stateManager = dependencies.stateManager ?? null;
    this.lifecycleManager = dependencies.lifecycleManager ?? null;
    this.navigationManager = dependencies.navigationManager ?? null;
  }

  // ==========================================================================
  // DEPENDENCY INJECTION
  // ==========================================================================

  /**
   * Set message receiver
   */
  public setMessageReceiver(receiver: MessageReceiver): void {
    this.messageReceiver = receiver;
  }

  /**
   * Set state manager
   */
  public setStateManager(manager: IStateManager): void {
    this.stateManager = manager;
  }

  /**
   * Set lifecycle manager
   */
  public setLifecycleManager(manager: ILifecycleManager): void {
    this.lifecycleManager = manager;
  }

  /**
   * Set navigation manager
   */
  public setNavigationManager(manager: INavigationManager): void {
    this.navigationManager = manager;
  }

  /**
   * Register handler registry
   */
  public registerHandlers(registry: IHandlerRegistry): void {
    this.handlerRegistries.push(registry);

    // If already running, register immediately
    if (this.messageReceiver && this.status === 'running') {
      registry.registerAll(this.messageReceiver);
    }
  }

  /**
   * Add additional component
   */
  public addComponent(component: IServiceComponent): void {
    this.components.set(component.name, component);

    // If already running, start immediately
    if (this.status === 'running') {
      this.startComponent(component);
    }
  }

  /**
   * Remove component
   */
  public removeComponent(name: string): void {
    const component = this.components.get(name);
    if (component) {
      this.stopComponent(component);
      this.components.delete(name);
    }
  }

  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================

  /**
   * Initialize all components
   */
  public async initialize(): Promise<InitResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const initialized: string[] = [];

    this.status = 'initializing';
    this.emitEvent({ type: 'initializing', timestamp: new Date() });

    try {
      // Restore state if configured
      if (this.coordinatorConfig.restoreStateOnStart && this.stateManager) {
        try {
          await this.stateManager.restore();
          initialized.push('state-restoration');
        } catch (error) {
          errors.push(`State restoration failed: ${error}`);
        }
      }

      // Register all handlers
      if (this.messageReceiver) {
        for (const registry of this.handlerRegistries) {
          try {
            registry.registerAll(this.messageReceiver);
            initialized.push(`handlers-${this.handlerRegistries.indexOf(registry)}`);
          } catch (error) {
            errors.push(`Handler registration failed: ${error}`);
          }
        }
      }

      // Setup lifecycle manager callbacks
      if (this.lifecycleManager) {
        this.lifecycleManager.onInstall(async (details) => {
          await this.handleInstall(details);
        });

        this.lifecycleManager.onStartup(async () => {
          await this.handleStartup();
        });

        initialized.push('lifecycle-manager');
      }

      this.status = errors.length > 0 ? 'error' : 'ready';
      this.initErrors = errors;
      this.stats.initializations++;

      this.emitEvent({
        type: 'initialized',
        timestamp: new Date(),
        details: { duration: Date.now() - startTime, errors, initialized },
      });

      return {
        success: errors.length === 0,
        duration: Date.now() - startTime,
        errors,
        componentsInitialized: initialized,
      };

    } catch (error) {
      this.status = 'error';
      this.stats.errors++;

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMessage);

      this.emitEvent({
        type: 'error',
        timestamp: new Date(),
        error: errorMessage,
      });

      return {
        success: false,
        duration: Date.now() - startTime,
        errors,
        componentsInitialized: initialized,
      };
    }
  }

  /**
   * Start the service
   */
  public async start(): Promise<void> {
    if (this.status !== 'ready' && this.status !== 'stopped') {
      throw new Error(`Cannot start from status: ${this.status}`);
    }

    this.status = 'running';
    this.startedAt = new Date();
    this.lastActivity = new Date();
    this.stats.startups++;

    this.emitEvent({ type: 'starting', timestamp: new Date() });

    // Start lifecycle manager
    if (this.lifecycleManager) {
      await this.startComponent(this.lifecycleManager);
    }

    // Start navigation manager
    if (this.navigationManager) {
      await this.startComponent(this.navigationManager);
    }

    // Start additional components
    for (const component of this.components.values()) {
      await this.startComponent(component);
    }

    // Start health checks
    this.startHealthChecks();

    this.emitEvent({ type: 'started', timestamp: new Date() });
  }

  /**
   * Stop the service
   */
  public async stop(): Promise<ShutdownResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const stopped: string[] = [];

    this.status = 'stopping';
    this.emitEvent({ type: 'stopping', timestamp: new Date() });

    try {
      // Stop health checks
      this.stopHealthChecks();

      // Save state if configured
      if (this.coordinatorConfig.saveStateOnStop && this.stateManager) {
        try {
          await this.stateManager.saveSnapshot();
          stopped.push('state-snapshot');
        } catch (error) {
          errors.push(`State save failed: ${error}`);
        }
      }

      // Stop additional components
      for (const component of this.components.values()) {
        try {
          await this.stopComponent(component);
          stopped.push(component.name);
        } catch (error) {
          errors.push(`Component ${component.name} stop failed: ${error}`);
        }
      }

      // Stop navigation manager
      if (this.navigationManager) {
        try {
          await this.stopComponent(this.navigationManager);
          stopped.push('navigation-manager');
        } catch (error) {
          errors.push(`Navigation manager stop failed: ${error}`);
        }
      }

      // Stop lifecycle manager
      if (this.lifecycleManager) {
        try {
          await this.stopComponent(this.lifecycleManager);
          stopped.push('lifecycle-manager');
        } catch (error) {
          errors.push(`Lifecycle manager stop failed: ${error}`);
        }
      }

      this.status = 'stopped';
      this.stats.shutdowns++;

      this.emitEvent({
        type: 'stopped',
        timestamp: new Date(),
        details: { duration: Date.now() - startTime, stopped },
      });

      return {
        success: errors.length === 0,
        duration: Date.now() - startTime,
        errors,
        componentsStopped: stopped,
      };

    } catch (error) {
      this.status = 'error';
      this.stats.errors++;

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMessage);

      return {
        success: false,
        duration: Date.now() - startTime,
        errors,
        componentsStopped: stopped,
      };
    }
  }

  /**
   * Restart the service
   */
  public async restart(): Promise<void> {
    await this.stop();
    await this.initialize();
    await this.start();
  }

  // ==========================================================================
  // COMPONENT MANAGEMENT
  // ==========================================================================

  /**
   * Start a component
   */
  private async startComponent(component: IServiceComponent): Promise<void> {
    try {
      await component.start();
      this.emitEvent({
        type: 'component_started',
        timestamp: new Date(),
        component: component.name,
      });
    } catch (error) {
      this.stats.errors++;
      this.emitEvent({
        type: 'component_error',
        timestamp: new Date(),
        component: component.name,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Stop a component
   */
  private async stopComponent(component: IServiceComponent): Promise<void> {
    try {
      await component.stop();
      this.emitEvent({
        type: 'component_stopped',
        timestamp: new Date(),
        component: component.name,
      });
    } catch (error) {
      this.stats.errors++;
      this.emitEvent({
        type: 'component_error',
        timestamp: new Date(),
        component: component.name,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  // ==========================================================================
  // LIFECYCLE HANDLERS
  // ==========================================================================

  /**
   * Handle extension install
   */
  private async handleInstall(details: unknown): Promise<void> {
    this.lastActivity = new Date();

    // Restore or initialize state
    if (this.stateManager) {
      if (this.lifecycleManager?.isUpdate()) {
        // Restore existing state on update
        await this.stateManager.restore();
      }
    }
  }

  /**
   * Handle browser startup
   */
  private async handleStartup(): Promise<void> {
    this.lastActivity = new Date();

    // Restore state
    if (this.stateManager) {
      await this.stateManager.restore();
    }
  }

  // ==========================================================================
  // HEALTH MONITORING
  // ==========================================================================

  /**
   * Get service health
   */
  public getHealth(): ServiceHealth {
    const components: ComponentStatus[] = [];

    // Lifecycle manager
    if (this.lifecycleManager) {
      components.push({
        name: 'lifecycle-manager',
        status: this.lifecycleManager.isActive?.() ? 'active' : 'inactive',
        statistics: this.lifecycleManager.getStats?.(),
      });
    }

    // Navigation manager
    if (this.navigationManager) {
      components.push({
        name: 'navigation-manager',
        status: this.navigationManager.isActive?.() ? 'active' : 'inactive',
        statistics: this.navigationManager.getStats?.(),
      });
    }

    // State manager
    if (this.stateManager) {
      components.push({
        name: 'state-manager',
        status: 'active',
        statistics: this.stateManager.getStats?.(),
      });
    }

    // Message receiver
    if (this.messageReceiver) {
      components.push({
        name: 'message-receiver',
        status: 'active',
      });
    }

    // Additional components
    for (const component of this.components.values()) {
      components.push({
        name: component.name,
        status: component.isActive?.() ? 'active' : 'inactive',
        statistics: component.getStats?.(),
      });
    }

    return {
      status: this.status,
      uptime: this.startedAt ? Date.now() - this.startedAt.getTime() : 0,
      startedAt: this.startedAt,
      components,
      lastActivity: this.lastActivity,
    };
  }

  /**
   * Start health check interval
   */
  private startHealthChecks(): void {
    if (this.coordinatorConfig.healthCheckInterval > 0) {
      this.healthCheckInterval = setInterval(() => {
        this.performHealthCheck();
      }, this.coordinatorConfig.healthCheckInterval);
    }
  }

  /**
   * Stop health check interval
   */
  private stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Perform health check
   */
  private performHealthCheck(): void {
    this.stats.healthChecks++;
    this.lastActivity = new Date();

    const health = this.getHealth();

    this.emitEvent({
      type: 'health_check',
      timestamp: new Date(),
      details: {
        status: health.status,
        uptime: health.uptime,
        componentCount: health.components.length,
        activeComponents: health.components.filter(c => c.status === 'active').length,
      },
    });
  }

  // ==========================================================================
  // STATE ACCESS
  // ==========================================================================

  /**
   * Get service status
   */
  public getStatus(): ServiceStatus {
    return this.status;
  }

  /**
   * Check if service is running
   */
  public isRunning(): boolean {
    return this.status === 'running';
  }

  /**
   * Check if service is ready
   */
  public isReady(): boolean {
    return this.status === 'ready' || this.status === 'running';
  }

  /**
   * Get initialization errors
   */
  public getInitErrors(): string[] {
    return [...this.initErrors];
  }

  /**
   * Get statistics
   */
  public getStats(): typeof this.stats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  public resetStats(): void {
    this.stats = {
      initializations: 0,
      startups: 0,
      shutdowns: 0,
      healthChecks: 0,
      errors: 0,
    };
  }

  /**
   * Record activity
   */
  public recordActivity(): void {
    this.lastActivity = new Date();
  }

  // ==========================================================================
  // EVENTS
  // ==========================================================================

  /**
   * Subscribe to events
   */
  public onEvent(listener: CoordinatorEventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /**
   * Emit event
   */
  private emitEvent(event: CoordinatorEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[ServiceCoordinator] Event listener error:', error);
      }
    });
  }

  // ==========================================================================
  // ACCESSORS
  // ==========================================================================

  /**
   * Get message receiver
   */
  public getMessageReceiver(): MessageReceiver | null {
    return this.messageReceiver;
  }

  /**
   * Get state manager
   */
  public getStateManager(): IStateManager | null {
    return this.stateManager;
  }

  /**
   * Get lifecycle manager
   */
  public getLifecycleManager(): ILifecycleManager | null {
    return this.lifecycleManager;
  }

  /**
   * Get navigation manager
   */
  public getNavigationManager(): INavigationManager | null {
    return this.navigationManager;
  }

  /**
   * Get component by name
   */
  public getComponent(name: string): IServiceComponent | undefined {
    return this.components.get(name);
  }

  /**
   * Get all component names
   */
  public getComponentNames(): string[] {
    return Array.from(this.components.keys());
  }

  /**
   * Get background config
   */
  public getBackgroundConfig(): BackgroundConfig {
    return this.backgroundConfig;
  }

  /**
   * Get coordinator config
   */
  public getCoordinatorConfig(): CoordinatorConfig {
    return { ...this.coordinatorConfig };
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create ServiceCoordinator instance
 */
export function createServiceCoordinator(
  backgroundConfig: BackgroundConfig,
  dependencies?: {
    messageReceiver?: MessageReceiver;
    stateManager?: IStateManager;
    lifecycleManager?: ILifecycleManager;
    navigationManager?: INavigationManager;
  },
  coordinatorConfig?: Partial<CoordinatorConfig>
): ServiceCoordinator {
  return new ServiceCoordinator(backgroundConfig, dependencies, coordinatorConfig);
}
