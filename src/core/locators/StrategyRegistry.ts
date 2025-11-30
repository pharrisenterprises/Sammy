/**
 * StrategyRegistry - Central registry for locator strategies
 * @module core/locators/StrategyRegistry
 * @version 1.0.0
 * 
 * Manages registration and retrieval of all locator strategies.
 * Maintains strategies in priority order for the 9-tier fallback chain.
 * 
 * Default Strategy Order (by priority):
 * 1. XPath (100% confidence) - priority 1
 * 2. ID (90% confidence) - priority 2
 * 3. Name (80% confidence) - priority 3
 * 4. ARIA Label (75% confidence) - priority 4
 * 5. Placeholder (70% confidence) - priority 5
 * 6. Data Attribute (65% confidence) - priority 6
 * 7. Fuzzy Text (40% confidence) - priority 7
 * 8. Bounding Box (35% confidence) - priority 8
 * 9. CSS Selector (60% confidence) - priority 9
 * 10. Form Label (72% confidence) - priority 10
 * 
 * @see ILocatorStrategy for strategy interface
 * @see locator-strategy_breakdown.md for fallback chain details
 */

import type { ILocatorStrategy } from './strategies/ILocatorStrategy';

// Import available strategy implementations
// Note: Some strategies are not yet implemented (P4-033 to P4-036)
import { getPlaceholderStrategy } from './strategies/PlaceholderStrategy';
import { getDataAttributeStrategy } from './strategies/DataAttributeStrategy';
import { getFuzzyTextStrategy } from './strategies/FuzzyTextStrategy';
import { getBoundingBoxStrategy } from './strategies/BoundingBoxStrategy';
import { getCssSelectorStrategy } from './strategies/CssSelectorStrategy';
import { getFormLabelStrategy } from './strategies/FormLabelStrategy';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default strategy names in priority order
 */
export const DEFAULT_STRATEGY_ORDER = [
  'xpath',
  'id',
  'name',
  'aria-label',
  'placeholder',
  'data-attribute',
  'fuzzy-text',
  'bounding-box',
  'css-selector',
  'form-label',
] as const;

/**
 * Strategy name type
 */
export type StrategyName = typeof DEFAULT_STRATEGY_ORDER[number] | string;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Registry entry with strategy and metadata
 */
export interface RegistryEntry {
  /** Strategy instance */
  strategy: ILocatorStrategy;
  /** Whether strategy is enabled */
  enabled: boolean;
  /** Custom priority override (null = use strategy default) */
  priorityOverride: number | null;
  /** Registration timestamp */
  registeredAt: number;
}

/**
 * Registry configuration options
 */
export interface RegistryConfig {
  /** Whether to auto-register default strategies */
  autoRegisterDefaults?: boolean;
  /** Strategies to disable by default */
  disabledStrategies?: StrategyName[];
  /** Custom priority overrides */
  priorityOverrides?: Record<StrategyName, number>;
}

/**
 * Strategy filter predicate
 */
export type StrategyFilter = (entry: RegistryEntry) => boolean;

// ============================================================================
// MAIN CLASS
// ============================================================================

/**
 * StrategyRegistry - Manages locator strategy registration and retrieval
 * 
 * Provides a centralized registry for all locator strategies with:
 * - Registration/unregistration of strategies
 * - Priority-based ordering
 * - Enable/disable controls
 * - Iteration in fallback order
 * 
 * @example
 * ```typescript
 * const registry = new StrategyRegistry();
 * registry.registerDefaults();
 * 
 * // Get all enabled strategies in order
 * for (const strategy of registry.getStrategies()) {
 *   const result = strategy.find(bundle, context);
 *   if (result.element) break;
 * }
 * ```
 */
export class StrategyRegistry {
  /**
   * Internal strategy map (name -> entry)
   */
  private strategies: Map<string, RegistryEntry> = new Map();
  
  /**
   * Cached sorted strategy list (invalidated on changes)
   */
  private sortedCache: ILocatorStrategy[] | null = null;
  
  /**
   * Registry configuration
   */
  private config: RegistryConfig;
  
  /**
   * Creates a new StrategyRegistry
   * 
   * @param config - Optional configuration
   */
  constructor(config: RegistryConfig = {}) {
    this.config = {
      autoRegisterDefaults: true,
      disabledStrategies: [],
      priorityOverrides: {},
      ...config,
    };
    
    if (this.config.autoRegisterDefaults) {
      this.registerDefaults();
    }
  }
  
  // ==========================================================================
  // REGISTRATION METHODS
  // ==========================================================================
  
  /**
   * Registers a strategy with the registry
   * 
   * @param strategy - Strategy instance to register
   * @param enabled - Whether strategy is enabled (default: true)
   * @returns This registry for chaining
   */
  register(strategy: ILocatorStrategy, enabled: boolean = true): this {
    const name = strategy.name;
    
    // Check for priority override
    const priorityOverride = this.config.priorityOverrides?.[name] ?? null;
    
    // Check if should be disabled by config
    const isDisabled = this.config.disabledStrategies?.includes(name) ?? false;
    
    this.strategies.set(name, {
      strategy,
      enabled: enabled && !isDisabled,
      priorityOverride,
      registeredAt: Date.now(),
    });
    
    // Invalidate cache
    this.sortedCache = null;
    
    return this;
  }
  
  /**
   * Unregisters a strategy by name
   * 
   * @param name - Strategy name to remove
   * @returns True if strategy was removed
   */
  unregister(name: string): boolean {
    const removed = this.strategies.delete(name);
    
    if (removed) {
      this.sortedCache = null;
    }
    
    return removed;
  }
  
  /**
   * Registers all default strategies
   * 
   * @returns This registry for chaining
   */
  registerDefaults(): this {
    // Register available strategies in priority order
    // Note: XPath, ID, Name, AriaLabel not yet implemented (P4-033 to P4-036)
    
    // TODO: Uncomment when P4-033 to P4-036 are implemented
    // this.register(getXPathStrategy());
    // this.register(getIdStrategy());
    // this.register(getNameStrategy());
    // this.register(getAriaLabelStrategy());
    
    this.register(getPlaceholderStrategy());
    this.register(getDataAttributeStrategy());
    this.register(getFuzzyTextStrategy());
    this.register(getBoundingBoxStrategy());
    this.register(getCssSelectorStrategy());
    this.register(getFormLabelStrategy());
    
    return this;
  }
  
  /**
   * Clears all registered strategies
   * 
   * @returns This registry for chaining
   */
  clear(): this {
    this.strategies.clear();
    this.sortedCache = null;
    return this;
  }
  
  // ==========================================================================
  // RETRIEVAL METHODS
  // ==========================================================================
  
  /**
   * Gets a strategy by name
   * 
   * @param name - Strategy name
   * @returns Strategy instance or undefined
   */
  get(name: string): ILocatorStrategy | undefined {
    return this.strategies.get(name)?.strategy;
  }
  
  /**
   * Gets a registry entry by name
   * 
   * @param name - Strategy name
   * @returns Registry entry or undefined
   */
  getEntry(name: string): RegistryEntry | undefined {
    return this.strategies.get(name);
  }
  
  /**
   * Checks if a strategy is registered
   * 
   * @param name - Strategy name
   * @returns True if registered
   */
  has(name: string): boolean {
    return this.strategies.has(name);
  }
  
  /**
   * Gets all strategies in priority order
   * 
   * @param enabledOnly - Only return enabled strategies (default: true)
   * @returns Array of strategies sorted by priority
   */
  getStrategies(enabledOnly: boolean = true): ILocatorStrategy[] {
    // Return cached if available and getting all enabled
    if (enabledOnly && this.sortedCache) {
      return this.sortedCache;
    }
    
    const entries = Array.from(this.strategies.values());
    
    // Filter if needed
    const filtered = enabledOnly
      ? entries.filter(e => e.enabled)
      : entries;
    
    // Sort by effective priority
    const sorted = filtered.sort((a, b) => {
      const priorityA = a.priorityOverride ?? a.strategy.priority;
      const priorityB = b.priorityOverride ?? b.strategy.priority;
      return priorityA - priorityB;
    });
    
    const strategies = sorted.map(e => e.strategy);
    
    // Cache if getting enabled only
    if (enabledOnly) {
      this.sortedCache = strategies;
    }
    
    return strategies;
  }
  
  /**
   * Gets all registry entries
   * 
   * @returns Array of all entries
   */
  getEntries(): RegistryEntry[] {
    return Array.from(this.strategies.values());
  }
  
  /**
   * Gets strategy names in priority order
   * 
   * @param enabledOnly - Only return enabled strategies
   * @returns Array of strategy names
   */
  getNames(enabledOnly: boolean = true): string[] {
    return this.getStrategies(enabledOnly).map(s => s.name);
  }
  
  /**
   * Gets the count of registered strategies
   * 
   * @param enabledOnly - Only count enabled strategies
   * @returns Number of strategies
   */
  count(enabledOnly: boolean = false): number {
    if (enabledOnly) {
      return Array.from(this.strategies.values()).filter(e => e.enabled).length;
    }
    return this.strategies.size;
  }
  
  // ==========================================================================
  // ENABLE/DISABLE METHODS
  // ==========================================================================
  
  /**
   * Enables a strategy
   * 
   * @param name - Strategy name
   * @returns True if strategy was enabled
   */
  enable(name: string): boolean {
    const entry = this.strategies.get(name);
    if (!entry) return false;
    
    if (!entry.enabled) {
      entry.enabled = true;
      this.sortedCache = null;
    }
    
    return true;
  }
  
  /**
   * Disables a strategy
   * 
   * @param name - Strategy name
   * @returns True if strategy was disabled
   */
  disable(name: string): boolean {
    const entry = this.strategies.get(name);
    if (!entry) return false;
    
    if (entry.enabled) {
      entry.enabled = false;
      this.sortedCache = null;
    }
    
    return true;
  }
  
  /**
   * Toggles a strategy's enabled state
   * 
   * @param name - Strategy name
   * @returns New enabled state or undefined if not found
   */
  toggle(name: string): boolean | undefined {
    const entry = this.strategies.get(name);
    if (!entry) return undefined;
    
    entry.enabled = !entry.enabled;
    this.sortedCache = null;
    
    return entry.enabled;
  }
  
  /**
   * Checks if a strategy is enabled
   * 
   * @param name - Strategy name
   * @returns True if enabled, false if disabled, undefined if not found
   */
  isEnabled(name: string): boolean | undefined {
    return this.strategies.get(name)?.enabled;
  }
  
  /**
   * Enables multiple strategies
   * 
   * @param names - Strategy names to enable
   * @returns This registry for chaining
   */
  enableAll(names: string[]): this {
    for (const name of names) {
      this.enable(name);
    }
    return this;
  }
  
  /**
   * Disables multiple strategies
   * 
   * @param names - Strategy names to disable
   * @returns This registry for chaining
   */
  disableAll(names: string[]): this {
    for (const name of names) {
      this.disable(name);
    }
    return this;
  }
  
  /**
   * Enables only the specified strategies (disables all others)
   * 
   * @param names - Strategy names to enable
   * @returns This registry for chaining
   */
  enableOnly(names: string[]): this {
    const nameSet = new Set(names);
    
    for (const [name, entry] of this.strategies) {
      entry.enabled = nameSet.has(name);
    }
    
    this.sortedCache = null;
    return this;
  }
  
  // ==========================================================================
  // PRIORITY METHODS
  // ==========================================================================
  
  /**
   * Sets a custom priority for a strategy
   * 
   * @param name - Strategy name
   * @param priority - New priority (lower = higher priority)
   * @returns True if priority was set
   */
  setPriority(name: string, priority: number): boolean {
    const entry = this.strategies.get(name);
    if (!entry) return false;
    
    entry.priorityOverride = priority;
    this.sortedCache = null;
    
    return true;
  }
  
  /**
   * Resets a strategy's priority to its default
   * 
   * @param name - Strategy name
   * @returns True if priority was reset
   */
  resetPriority(name: string): boolean {
    const entry = this.strategies.get(name);
    if (!entry) return false;
    
    entry.priorityOverride = null;
    this.sortedCache = null;
    
    return true;
  }
  
  /**
   * Gets the effective priority for a strategy
   * 
   * @param name - Strategy name
   * @returns Priority or undefined if not found
   */
  getPriority(name: string): number | undefined {
    const entry = this.strategies.get(name);
    if (!entry) return undefined;
    
    return entry.priorityOverride ?? entry.strategy.priority;
  }
  
  /**
   * Reorders strategies by setting new priorities
   * 
   * @param order - Array of strategy names in desired order
   * @returns This registry for chaining
   */
  reorder(order: string[]): this {
    order.forEach((name, index) => {
      this.setPriority(name, index + 1);
    });
    
    return this;
  }
  
  // ==========================================================================
  // FILTERING METHODS
  // ==========================================================================
  
  /**
   * Filters strategies by a predicate
   * 
   * @param predicate - Filter function
   * @returns Array of matching strategies
   */
  filter(predicate: StrategyFilter): ILocatorStrategy[] {
    const entries = Array.from(this.strategies.values());
    return entries
      .filter(predicate)
      .sort((a, b) => {
        const priorityA = a.priorityOverride ?? a.strategy.priority;
        const priorityB = b.priorityOverride ?? b.strategy.priority;
        return priorityA - priorityB;
      })
      .map(e => e.strategy);
  }
  
  /**
   * Gets strategies by base confidence threshold
   * 
   * @param minConfidence - Minimum base confidence (0-1)
   * @returns Array of strategies meeting threshold
   */
  getByMinConfidence(minConfidence: number): ILocatorStrategy[] {
    return this.filter(entry => 
      entry.enabled && entry.strategy.baseConfidence >= minConfidence
    );
  }
  
  /**
   * Gets high-confidence strategies (>= 70%)
   * 
   * @returns Array of high-confidence strategies
   */
  getHighConfidence(): ILocatorStrategy[] {
    return this.getByMinConfidence(0.70);
  }
  
  /**
   * Gets low-confidence/fallback strategies (< 50%)
   * 
   * @returns Array of fallback strategies
   */
  getFallback(): ILocatorStrategy[] {
    return this.filter(entry =>
      entry.enabled && entry.strategy.baseConfidence < 0.50
    );
  }
  
  // ==========================================================================
  // ITERATION METHODS
  // ==========================================================================
  
  /**
   * Iterates over enabled strategies in priority order
   * 
   * @yields Strategy instances
   */
  *[Symbol.iterator](): Iterator<ILocatorStrategy> {
    for (const strategy of this.getStrategies()) {
      yield strategy;
    }
  }
  
  /**
   * Iterates over entries in priority order
   * 
   * @param enabledOnly - Only iterate enabled entries
   * @yields Registry entries
   */
  *entries(enabledOnly: boolean = true): Generator<RegistryEntry> {
    const allEntries = Array.from(this.strategies.values());
    
    const filtered = enabledOnly
      ? allEntries.filter(e => e.enabled)
      : allEntries;
    
    const sorted = filtered.sort((a, b) => {
      const priorityA = a.priorityOverride ?? a.strategy.priority;
      const priorityB = b.priorityOverride ?? b.strategy.priority;
      return priorityA - priorityB;
    });
    
    for (const entry of sorted) {
      yield entry;
    }
  }
  
  // ==========================================================================
  // SERIALIZATION METHODS
  // ==========================================================================
  
  /**
   * Exports registry state for persistence
   * 
   * @returns Serializable state object
   */
  export(): {
    strategies: Array<{
      name: string;
      enabled: boolean;
      priorityOverride: number | null;
    }>;
  } {
    const strategies = Array.from(this.strategies.entries()).map(
      ([name, entry]) => ({
        name,
        enabled: entry.enabled,
        priorityOverride: entry.priorityOverride,
      })
    );
    
    return { strategies };
  }
  
  /**
   * Imports registry state from persistence
   * Note: Only updates existing strategies, doesn't create new ones
   * 
   * @param state - Previously exported state
   * @returns This registry for chaining
   */
  import(state: {
    strategies: Array<{
      name: string;
      enabled: boolean;
      priorityOverride: number | null;
    }>;
  }): this {
    for (const { name, enabled, priorityOverride } of state.strategies) {
      const entry = this.strategies.get(name);
      if (entry) {
        entry.enabled = enabled;
        entry.priorityOverride = priorityOverride;
      }
    }
    
    this.sortedCache = null;
    return this;
  }
  
  // ==========================================================================
  // DEBUG METHODS
  // ==========================================================================
  
  /**
   * Gets a debug summary of the registry
   * 
   * @returns Debug information object
   */
  debug(): {
    total: number;
    enabled: number;
    disabled: number;
    order: Array<{ name: string; priority: number; enabled: boolean; confidence: number }>;
  } {
    const entries = Array.from(this.strategies.values());
    const enabled = entries.filter(e => e.enabled).length;
    
    const order = entries
      .sort((a, b) => {
        const priorityA = a.priorityOverride ?? a.strategy.priority;
        const priorityB = b.priorityOverride ?? b.strategy.priority;
        return priorityA - priorityB;
      })
      .map(e => ({
        name: e.strategy.name,
        priority: e.priorityOverride ?? e.strategy.priority,
        enabled: e.enabled,
        confidence: e.strategy.baseConfidence,
      }));
    
    return {
      total: entries.length,
      enabled,
      disabled: entries.length - enabled,
      order,
    };
  }
}

// ============================================================================
// FACTORY & SINGLETON
// ============================================================================

/**
 * Singleton instance of StrategyRegistry
 */
let instance: StrategyRegistry | null = null;

/**
 * Gets or creates the global StrategyRegistry singleton
 * 
 * @returns StrategyRegistry instance
 */
export function getStrategyRegistry(): StrategyRegistry {
  if (!instance) {
    instance = new StrategyRegistry();
  }
  return instance;
}

/**
 * Creates a new StrategyRegistry instance (for testing or isolation)
 * 
 * @param config - Optional configuration
 * @returns New StrategyRegistry instance
 */
export function createStrategyRegistry(config?: RegistryConfig): StrategyRegistry {
  return new StrategyRegistry(config);
}

/**
 * Resets the global singleton (for testing)
 */
export function resetStrategyRegistry(): void {
  instance = null;
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default StrategyRegistry;
