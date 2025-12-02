/**
 * LabelDetectorRegistry - Central Registry for Label Detectors
 * @module core/recording/labels/LabelDetectorRegistry
 * @version 1.0.0
 * 
 * Manages all label detection strategies with priority-based ordering,
 * enable/disable functionality, and plugin architecture for custom detectors.
 * 
 * ## Features
 * - Register/unregister detectors dynamically
 * - Priority-sorted retrieval (lower number = higher priority)
 * - Enable/disable individual detectors
 * - Default detector set with all built-in detectors
 * - Singleton access for global registry
 * 
 * ## Default Priority Order
 * 1. Google Forms (10) - Framework-specific, highest confidence
 * 2. ARIA (20) - Accessibility attributes
 * 3. Associated Label (25) - HTML form labels
 * 4. Placeholder (40) - Attribute-based
 * 5. Bootstrap (50) - CSS framework
 * 6. Material-UI (50) - CSS framework
 * 7. Sibling (60) - Proximity-based
 * 8. Text Content (80) - Fallback
 * 
 * @see ILabelDetector for detector interface
 */

import type { ILabelDetector } from './ILabelDetector';

// Import all built-in detectors
import { AriaLabelDetector } from './AriaLabelDetector';
import { PlaceholderDetector } from './PlaceholderDetector';
import { AssociatedLabelDetector } from './AssociatedLabelDetector';
import { TextContentDetector } from './TextContentDetector';
import { GoogleFormsDetector } from './GoogleFormsDetector';
import { BootstrapDetector } from './BootstrapDetector';
import { MaterialUIDetector } from './MaterialUIDetector';
import { SiblingDetector } from './SiblingDetector';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Registry change event types
 */
export type RegistryEventType = 
  | 'registered'
  | 'unregistered'
  | 'enabled'
  | 'disabled'
  | 'priorityChanged'
  | 'cleared';

/**
 * Registry change event
 */
export interface RegistryEvent {
  /** Event type */
  type: RegistryEventType;
  
  /** Detector name (if applicable) */
  detectorName?: string;
  
  /** Timestamp */
  timestamp: number;
}

/**
 * Registry event listener
 */
export type RegistryEventListener = (event: RegistryEvent) => void;

/**
 * Detector registration options
 */
export interface RegistrationOptions {
  /** Whether to enable the detector immediately (default: true) */
  enabled?: boolean;
  
  /** Override the detector's default priority */
  priorityOverride?: number;
  
  /** Replace existing detector with same name */
  replace?: boolean;
}

/**
 * Registry configuration
 */
export interface RegistryConfig {
  /** Whether to load default detectors on creation */
  loadDefaults?: boolean;
  
  /** Detectors to exclude from defaults */
  excludeDefaults?: string[];
  
  /** Custom detectors to add */
  customDetectors?: ILabelDetector[];
}

/**
 * Registry statistics
 */
export interface RegistryStats {
  /** Total registered detectors */
  total: number;
  
  /** Number of enabled detectors */
  enabled: number;
  
  /** Number of disabled detectors */
  disabled: number;
  
  /** Detector names by priority order */
  byPriority: string[];
}

// ============================================================================
// LABEL DETECTOR REGISTRY CLASS
// ============================================================================

/**
 * Central registry for managing label detection strategies
 * 
 * @example
 * ```typescript
 * // Get default registry with all built-in detectors
 * const registry = LabelDetectorRegistry.createDefault();
 * 
 * // Get all enabled detectors in priority order
 * const detectors = registry.getEnabled();
 * 
 * // Register a custom detector
 * registry.register(new CustomLabelDetector());
 * 
 * // Disable a specific detector
 * registry.disable('placeholder');
 * ```
 */
export class LabelDetectorRegistry {
  /** Registered detectors by name */
  private detectors: Map<string, ILabelDetector>;
  
  /** Set of enabled detector names */
  private enabledSet: Set<string>;
  
  /** Priority overrides by detector name */
  private priorityOverrides: Map<string, number>;
  
  /** Event listeners */
  private listeners: Set<RegistryEventListener>;
  
  /** Singleton instance */
  private static instance: LabelDetectorRegistry | null = null;
  
  /**
   * Create a new registry
   */
  constructor(config: RegistryConfig = {}) {
    this.detectors = new Map();
    this.enabledSet = new Set();
    this.priorityOverrides = new Map();
    this.listeners = new Set();
    
    // Load defaults if configured
    if (config.loadDefaults !== false) {
      this.loadDefaultDetectors(config.excludeDefaults || []);
    }
    
    // Add custom detectors
    if (config.customDetectors) {
      for (const detector of config.customDetectors) {
        this.register(detector);
      }
    }
  }
  
  // ==========================================================================
  // SINGLETON ACCESS
  // ==========================================================================
  
  /**
   * Get the singleton registry instance
   */
  static getInstance(): LabelDetectorRegistry {
    if (!LabelDetectorRegistry.instance) {
      LabelDetectorRegistry.instance = LabelDetectorRegistry.createDefault();
    }
    return LabelDetectorRegistry.instance;
  }
  
  /**
   * Reset the singleton instance (useful for testing)
   */
  static resetInstance(): void {
    LabelDetectorRegistry.instance = null;
  }
  
  /**
   * Set a custom singleton instance
   */
  static setInstance(registry: LabelDetectorRegistry): void {
    LabelDetectorRegistry.instance = registry;
  }
  
  // ==========================================================================
  // FACTORY METHODS
  // ==========================================================================
  
  /**
   * Create a registry with all default detectors
   */
  static createDefault(): LabelDetectorRegistry {
    return new LabelDetectorRegistry({ loadDefaults: true });
  }
  
  /**
   * Create an empty registry
   */
  static createEmpty(): LabelDetectorRegistry {
    return new LabelDetectorRegistry({ loadDefaults: false });
  }
  
  /**
   * Create a registry with specific detectors only
   */
  static createWith(detectorNames: string[]): LabelDetectorRegistry {
    const registry = new LabelDetectorRegistry({ loadDefaults: false });
    const defaultDetectors = createDefaultDetectors();
    
    for (const name of detectorNames) {
      const detector = defaultDetectors.find(d => d.name === name);
      if (detector) {
        registry.register(detector);
      }
    }
    
    return registry;
  }
  
  // ==========================================================================
  // REGISTRATION
  // ==========================================================================
  
  /**
   * Register a detector
   */
  register(detector: ILabelDetector, options: RegistrationOptions = {}): void {
    const { enabled = true, priorityOverride, replace = false } = options;
    const name = detector.name;
    
    // Check for existing
    if (this.detectors.has(name) && !replace) {
      throw new Error(`Detector "${name}" is already registered. Use replace: true to override.`);
    }
    
    // Store detector
    this.detectors.set(name, detector);
    
    // Handle priority override
    if (priorityOverride !== undefined) {
      this.priorityOverrides.set(name, priorityOverride);
    }
    
    // Enable if requested
    if (enabled) {
      this.enabledSet.add(name);
    }
    
    // Emit event
    this.emit({ type: 'registered', detectorName: name, timestamp: Date.now() });
  }
  
  /**
   * Unregister a detector
   */
  unregister(name: string): boolean {
    if (!this.detectors.has(name)) {
      return false;
    }
    
    this.detectors.delete(name);
    this.enabledSet.delete(name);
    this.priorityOverrides.delete(name);
    
    // Emit event
    this.emit({ type: 'unregistered', detectorName: name, timestamp: Date.now() });
    
    return true;
  }
  
  /**
   * Check if a detector is registered
   */
  has(name: string): boolean {
    return this.detectors.has(name);
  }
  
  // ==========================================================================
  // RETRIEVAL
  // ==========================================================================
  
  /**
   * Get a detector by name
   */
  get(name: string): ILabelDetector | undefined {
    return this.detectors.get(name);
  }
  
  /**
   * Get all registered detectors (sorted by priority)
   */
  getAll(): ILabelDetector[] {
    return this.getSorted([...this.detectors.values()]);
  }
  
  /**
   * Get all enabled detectors (sorted by priority)
   */
  getEnabled(): ILabelDetector[] {
    const enabled = [...this.detectors.values()]
      .filter(d => this.enabledSet.has(d.name));
    return this.getSorted(enabled);
  }
  
  /**
   * Get all disabled detectors
   */
  getDisabled(): ILabelDetector[] {
    const disabled = [...this.detectors.values()]
      .filter(d => !this.enabledSet.has(d.name));
    return this.getSorted(disabled);
  }
  
  /**
   * Get detector names
   */
  getNames(): string[] {
    return [...this.detectors.keys()];
  }
  
  /**
   * Get enabled detector names
   */
  getEnabledNames(): string[] {
    return [...this.enabledSet];
  }
  
  /**
   * Sort detectors by priority (lower = higher priority)
   */
  private getSorted(detectors: ILabelDetector[]): ILabelDetector[] {
    return detectors.sort((a, b) => {
      const priorityA = this.getPriority(a.name);
      const priorityB = this.getPriority(b.name);
      return priorityA - priorityB;
    });
  }
  
  /**
   * Get effective priority for a detector
   */
  getPriority(name: string): number {
    // Check for override
    const override = this.priorityOverrides.get(name);
    if (override !== undefined) {
      return override;
    }
    
    // Use detector's default priority
    const detector = this.detectors.get(name);
    return detector?.priority ?? 100;
  }
  
  // ==========================================================================
  // ENABLE/DISABLE
  // ==========================================================================
  
  /**
   * Enable a detector
   */
  enable(name: string): boolean {
    if (!this.detectors.has(name)) {
      return false;
    }
    
    if (!this.enabledSet.has(name)) {
      this.enabledSet.add(name);
      this.emit({ type: 'enabled', detectorName: name, timestamp: Date.now() });
    }
    
    return true;
  }
  
  /**
   * Disable a detector
   */
  disable(name: string): boolean {
    if (!this.detectors.has(name)) {
      return false;
    }
    
    if (this.enabledSet.has(name)) {
      this.enabledSet.delete(name);
      this.emit({ type: 'disabled', detectorName: name, timestamp: Date.now() });
    }
    
    return true;
  }
  
  /**
   * Check if a detector is enabled
   */
  isEnabled(name: string): boolean {
    return this.enabledSet.has(name);
  }
  
  /**
   * Enable all detectors
   */
  enableAll(): void {
    for (const name of this.detectors.keys()) {
      this.enabledSet.add(name);
    }
  }
  
  /**
   * Disable all detectors
   */
  disableAll(): void {
    this.enabledSet.clear();
  }
  
  /**
   * Enable only specified detectors
   */
  enableOnly(names: string[]): void {
    this.disableAll();
    for (const name of names) {
      if (this.detectors.has(name)) {
        this.enabledSet.add(name);
      }
    }
  }
  
  // ==========================================================================
  // PRIORITY MANAGEMENT
  // ==========================================================================
  
  /**
   * Set priority override for a detector
   */
  setPriority(name: string, priority: number): boolean {
    if (!this.detectors.has(name)) {
      return false;
    }
    
    this.priorityOverrides.set(name, priority);
    this.emit({ type: 'priorityChanged', detectorName: name, timestamp: Date.now() });
    
    return true;
  }
  
  /**
   * Reset priority to detector's default
   */
  resetPriority(name: string): boolean {
    if (!this.priorityOverrides.has(name)) {
      return false;
    }
    
    this.priorityOverrides.delete(name);
    this.emit({ type: 'priorityChanged', detectorName: name, timestamp: Date.now() });
    
    return true;
  }
  
  /**
   * Reset all priority overrides
   */
  resetAllPriorities(): void {
    this.priorityOverrides.clear();
  }
  
  // ==========================================================================
  // EVENTS
  // ==========================================================================
  
  /**
   * Add event listener
   */
  addEventListener(listener: RegistryEventListener): void {
    this.listeners.add(listener);
  }
  
  /**
   * Remove event listener
   */
  removeEventListener(listener: RegistryEventListener): void {
    this.listeners.delete(listener);
  }
  
  /**
   * Emit event to all listeners
   */
  private emit(event: RegistryEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Registry event listener error:', error);
      }
    }
  }
  
  // ==========================================================================
  // STATISTICS
  // ==========================================================================
  
  /**
   * Get registry statistics
   */
  getStats(): RegistryStats {
    const all = this.getAll();
    return {
      total: this.detectors.size,
      enabled: this.enabledSet.size,
      disabled: this.detectors.size - this.enabledSet.size,
      byPriority: all.map(d => d.name),
    };
  }
  
  /**
   * Get size of registry
   */
  get size(): number {
    return this.detectors.size;
  }
  
  // ==========================================================================
  // CLEAR/RESET
  // ==========================================================================
  
  /**
   * Clear all detectors
   */
  clear(): void {
    this.detectors.clear();
    this.enabledSet.clear();
    this.priorityOverrides.clear();
    this.emit({ type: 'cleared', timestamp: Date.now() });
  }
  
  /**
   * Reset to default detectors
   */
  reset(): void {
    this.clear();
    this.loadDefaultDetectors([]);
  }
  
  // ==========================================================================
  // DEFAULT DETECTORS
  // ==========================================================================
  
  /**
   * Load default detectors
   */
  private loadDefaultDetectors(exclude: string[]): void {
    const defaults = createDefaultDetectors();
    
    for (const detector of defaults) {
      if (!exclude.includes(detector.name)) {
        this.register(detector, { enabled: true });
      }
    }
  }
  
  // ==========================================================================
  // ITERATION
  // ==========================================================================
  
  /**
   * Iterate over all detectors
   */
  *[Symbol.iterator](): Iterator<ILabelDetector> {
    yield* this.getAll();
  }
  
  /**
   * Iterate over enabled detectors
   */
  *enabledIterator(): Generator<ILabelDetector> {
    yield* this.getEnabled();
  }
  
  /**
   * ForEach over enabled detectors
   */
  forEachEnabled(callback: (detector: ILabelDetector, index: number) => void): void {
    this.getEnabled().forEach(callback);
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create all default detectors
 */
export function createDefaultDetectors(): ILabelDetector[] {
  return [
    new GoogleFormsDetector(),
    new AriaLabelDetector(),
    new AssociatedLabelDetector(),
    new PlaceholderDetector(),
    new BootstrapDetector(),
    new MaterialUIDetector(),
    new SiblingDetector(),
    new TextContentDetector(),
  ];
}

/**
 * Get default detector names
 */
export function getDefaultDetectorNames(): string[] {
  return [
    'google-forms',
    'aria-label',
    'associated-label',
    'placeholder',
    'bootstrap',
    'material-ui',
    'sibling',
    'text-content',
  ];
}

/**
 * Create a detector by name
 */
export function createDetectorByName(name: string): ILabelDetector | null {
  switch (name) {
    case 'google-forms':
      return new GoogleFormsDetector();
    case 'aria-label':
      return new AriaLabelDetector();
    case 'associated-label':
      return new AssociatedLabelDetector();
    case 'placeholder':
      return new PlaceholderDetector();
    case 'bootstrap':
      return new BootstrapDetector();
    case 'material-ui':
      return new MaterialUIDetector();
    case 'sibling':
      return new SiblingDetector();
    case 'text-content':
      return new TextContentDetector();
    default:
      return null;
  }
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

/**
 * Get the global registry instance
 */
export function getRegistry(): LabelDetectorRegistry {
  return LabelDetectorRegistry.getInstance();
}

/**
 * Get all enabled detectors from global registry
 */
export function getEnabledDetectors(): ILabelDetector[] {
  return LabelDetectorRegistry.getInstance().getEnabled();
}

/**
 * Register a detector to global registry
 */
export function registerDetector(detector: ILabelDetector, options?: RegistrationOptions): void {
  LabelDetectorRegistry.getInstance().register(detector, options);
}

/**
 * Unregister a detector from global registry
 */
export function unregisterDetector(name: string): boolean {
  return LabelDetectorRegistry.getInstance().unregister(name);
}
