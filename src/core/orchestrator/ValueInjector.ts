/**
 * ValueInjector - Injects CSV values into step objects during execution
 * @module core/orchestrator/ValueInjector
 * @version 1.0.0
 * 
 * Handles the mapping of CSV row data to recorded steps:
 * 1. Direct match: CSV column name matches step label exactly
 * 2. Mapped match: Field mapping associates CSV column to step label
 * 
 * Uses the mappingLookup pattern for O(1) reverse lookups.
 * 
 * @see test-orchestrator_breakdown.md for value injection details
 * @see csv-processing_breakdown.md for field mapping format
 */

import type { Step, StepEvent } from '../types/step';
import type { Field } from '../types/field';

// ============================================================================
// TYPES
// ============================================================================

/**
 * CSV row data - column name to value mapping
 */
export type CsvRow = Record<string, string>;

/**
 * Injection result for a single step
 */
export interface InjectionResult {
  /** Original step (unmodified) */
  originalStep: Step;
  /** Step with injected value */
  injectedStep: Step;
  /** Whether a value was injected */
  wasInjected: boolean;
  /** Source of the value: 'direct', 'mapped', or 'original' */
  source: 'direct' | 'mapped' | 'original';
  /** CSV column name used (if any) */
  csvColumn?: string;
  /** Original value (before injection) */
  originalValue?: string;
  /** Injected value */
  injectedValue?: string;
}

/**
 * Batch injection result for all steps
 */
export interface BatchInjectionResult {
  /** Steps with injected values */
  steps: Step[];
  /** Detailed results per step */
  results: InjectionResult[];
  /** Count of steps that received injected values */
  injectedCount: number;
  /** Count of steps that kept original values */
  originalCount: number;
  /** Count of input steps skipped (no value available) */
  skippedCount: number;
}

/**
 * Configuration for value injection
 */
export interface ValueInjectorConfig {
  /** Skip input steps with no CSV value (default: true) */
  skipInputsWithoutValue: boolean;
  /** Log injection operations (default: false) */
  enableLogging: boolean;
  /** Preserve original value in step.originalValue (default: false) */
  preserveOriginal: boolean;
  /** Case-sensitive label matching (default: true) */
  caseSensitiveMatch: boolean;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

/**
 * Default configuration for ValueInjector
 */
export const DEFAULT_VALUE_INJECTOR_CONFIG: ValueInjectorConfig = {
  skipInputsWithoutValue: true,
  enableLogging: false,
  preserveOriginal: false,
  caseSensitiveMatch: true,
};

// ============================================================================
// VALUE INJECTOR CLASS
// ============================================================================

/**
 * ValueInjector - Injects CSV values into steps during test execution
 * 
 * @example
 * ```typescript
 * const injector = new ValueInjector(fieldMappings);
 * const result = injector.injectRow(csvRow, steps);
 * console.log(`Injected ${result.injectedCount} values`);
 * ```
 */
export class ValueInjector {
  private mappingLookup: Map<string, string>;
  private reverseLookup: Map<string, string>;
  private config: ValueInjectorConfig;
  private logs: string[] = [];

  /**
   * Create a new ValueInjector
   * 
   * @param fieldMappings - Array of Field objects from CSV mapping
   * @param config - Optional configuration overrides
   */
  constructor(
    fieldMappings: Field[],
    config: Partial<ValueInjectorConfig> = {}
  ) {
    this.config = { ...DEFAULT_VALUE_INJECTOR_CONFIG, ...config };
    this.mappingLookup = new Map();
    this.reverseLookup = new Map();
    
    this.buildMappingLookups(fieldMappings);
  }

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  /**
   * Build mapping lookup tables from field mappings
   * 
   * Creates two lookups:
   * - mappingLookup: csvColumn -> stepLabel (for finding value)
   * - reverseLookup: stepLabel -> csvColumn (for direct access)
   */
  private buildMappingLookups(fieldMappings: Field[]): void {
    for (const mapping of fieldMappings) {
      if (mapping.mapped && mapping.field_name && mapping.inputvarfields) {
        const csvColumn = this.config.caseSensitiveMatch 
          ? mapping.field_name 
          : mapping.field_name.toLowerCase();
        const stepLabel = this.config.caseSensitiveMatch
          ? mapping.inputvarfields
          : mapping.inputvarfields.toLowerCase();
        
        // csvColumn -> stepLabel
        this.mappingLookup.set(csvColumn, stepLabel);
        
        // stepLabel -> csvColumn
        this.reverseLookup.set(stepLabel, csvColumn);
      }
    }
    
    this.log(`Built mapping lookups: ${this.mappingLookup.size} mappings`);
  }

  // ==========================================================================
  // CORE INJECTION METHODS
  // ==========================================================================

  /**
   * Inject values from a CSV row into a single step
   * 
   * Lookup order:
   * 1. Direct match: row[step.label]
   * 2. Mapped match: row[csvColumn] where mapping[csvColumn] = step.label
   * 3. Keep original value if no match found
   * 
   * @param row - CSV row data
   * @param step - Step to inject value into
   * @returns Injection result with details
   */
  public injectStep(row: CsvRow, step: Step): InjectionResult {
    // Clone step to avoid mutation
    const injectedStep: Step = { ...step };
    const stepLabel = this.config.caseSensitiveMatch 
      ? step.label 
      : step.label?.toLowerCase();

    // Only inject into input or click events
    if (step.event !== 'input' && step.event !== 'click') {
      return {
        originalStep: step,
        injectedStep,
        wasInjected: false,
        source: 'original',
        originalValue: step.value,
      };
    }

    // Try direct match first
    const directValue = this.findDirectValue(row, stepLabel);
    if (directValue !== undefined) {
      injectedStep.value = directValue;
      
      if (this.config.preserveOriginal) {
        (injectedStep as Step & { originalValue?: string }).originalValue = step.value;
      }
      
      this.log(`Direct inject: "${step.label}" <- "${directValue}"`);
      
      return {
        originalStep: step,
        injectedStep,
        wasInjected: true,
        source: 'direct',
        csvColumn: step.label,
        originalValue: step.value,
        injectedValue: directValue,
      };
    }

    // Try mapped match
    const mappedResult = this.findMappedValue(row, stepLabel);
    if (mappedResult !== undefined) {
      injectedStep.value = mappedResult.value;
      
      if (this.config.preserveOriginal) {
        (injectedStep as Step & { originalValue?: string }).originalValue = step.value;
      }
      
      this.log(`Mapped inject: "${step.label}" <- "${mappedResult.value}" (from "${mappedResult.csvColumn}")`);
      
      return {
        originalStep: step,
        injectedStep,
        wasInjected: true,
        source: 'mapped',
        csvColumn: mappedResult.csvColumn,
        originalValue: step.value,
        injectedValue: mappedResult.value,
      };
    }

    // No match found - keep original
    this.log(`No match: "${step.label}" keeping original value`);
    
    return {
      originalStep: step,
      injectedStep,
      wasInjected: false,
      source: 'original',
      originalValue: step.value,
    };
  }

  /**
   * Inject values from a CSV row into all steps
   * 
   * @param row - CSV row data
   * @param steps - Array of steps to process
   * @returns Batch result with all injected steps and statistics
   */
  public injectRow(row: CsvRow, steps: Step[]): BatchInjectionResult {
    const results: InjectionResult[] = [];
    const injectedSteps: Step[] = [];
    
    let injectedCount = 0;
    let originalCount = 0;
    let skippedCount = 0;

    for (const step of steps) {
      const result = this.injectStep(row, step);
      
      // Handle skipping input steps without values
      if (
        this.config.skipInputsWithoutValue &&
        step.event === 'input' &&
        !result.wasInjected &&
        !step.value
      ) {
        skippedCount++;
        // Mark as skipped (add status if present)
        const skippedStep = { ...result.injectedStep };
        (skippedStep as Step & { status?: string }).status = 'skipped';
        injectedSteps.push(skippedStep);
        results.push(result);
        continue;
      }

      if (result.wasInjected) {
        injectedCount++;
      } else {
        originalCount++;
      }
      
      injectedSteps.push(result.injectedStep);
      results.push(result);
    }

    return {
      steps: injectedSteps,
      results,
      injectedCount,
      originalCount,
      skippedCount,
    };
  }

  // ==========================================================================
  // VALUE LOOKUP HELPERS
  // ==========================================================================

  /**
   * Find value by direct column name match
   * 
   * @param row - CSV row data
   * @param stepLabel - Step label to match
   * @returns Value if found, undefined otherwise
   */
  private findDirectValue(row: CsvRow, stepLabel?: string): string | undefined {
    if (!stepLabel) return undefined;

    if (this.config.caseSensitiveMatch) {
      return row[stepLabel];
    }

    // Case-insensitive search
    const lowerLabel = stepLabel.toLowerCase();
    for (const [key, value] of Object.entries(row)) {
      if (key.toLowerCase() === lowerLabel) {
        return value;
      }
    }
    
    return undefined;
  }

  /**
   * Find value through field mapping
   * 
   * @param row - CSV row data
   * @param stepLabel - Step label to match
   * @returns Object with value and csvColumn if found, undefined otherwise
   */
  private findMappedValue(
    row: CsvRow, 
    stepLabel?: string
  ): { value: string; csvColumn: string } | undefined {
    if (!stepLabel) return undefined;

    // Use reverse lookup to find which CSV column maps to this step
    const csvColumn = this.reverseLookup.get(stepLabel);
    if (!csvColumn) return undefined;

    // Get value from row
    const value = this.config.caseSensitiveMatch
      ? row[csvColumn]
      : this.findDirectValue(row, csvColumn);
    
    if (value !== undefined) {
      return { value, csvColumn };
    }

    return undefined;
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Check if a step label has a mapping
   * 
   * @param stepLabel - Step label to check
   * @returns True if there's a mapping for this label
   */
  public hasMapping(stepLabel: string): boolean {
    const label = this.config.caseSensitiveMatch 
      ? stepLabel 
      : stepLabel.toLowerCase();
    return this.reverseLookup.has(label);
  }

  /**
   * Get the CSV column that maps to a step label
   * 
   * @param stepLabel - Step label
   * @returns CSV column name or undefined
   */
  public getMappedColumn(stepLabel: string): string | undefined {
    const label = this.config.caseSensitiveMatch 
      ? stepLabel 
      : stepLabel.toLowerCase();
    return this.reverseLookup.get(label);
  }

  /**
   * Get the step label that a CSV column maps to
   * 
   * @param csvColumn - CSV column name
   * @returns Step label or undefined
   */
  public getMappedLabel(csvColumn: string): string | undefined {
    const column = this.config.caseSensitiveMatch 
      ? csvColumn 
      : csvColumn.toLowerCase();
    return this.mappingLookup.get(column);
  }

  /**
   * Get all CSV columns that have mappings
   */
  public getMappedColumns(): string[] {
    return Array.from(this.mappingLookup.keys());
  }

  /**
   * Get all step labels that have mappings
   */
  public getMappedLabels(): string[] {
    return Array.from(this.reverseLookup.keys());
  }

  /**
   * Get the total number of mappings
   */
  public getMappingCount(): number {
    return this.mappingLookup.size;
  }

  /**
   * Update field mappings (for runtime reconfiguration)
   * 
   * @param fieldMappings - New field mappings
   */
  public updateMappings(fieldMappings: Field[]): void {
    this.mappingLookup.clear();
    this.reverseLookup.clear();
    this.buildMappingLookups(fieldMappings);
  }

  /**
   * Get configuration
   */
  public getConfig(): ValueInjectorConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   * 
   * @param config - Partial config to merge
   */
  public updateConfig(config: Partial<ValueInjectorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ==========================================================================
  // LOGGING
  // ==========================================================================

  /**
   * Internal logging
   */
  private log(message: string): void {
    if (this.config.enableLogging) {
      const timestamp = new Date().toISOString();
      this.logs.push(`[${timestamp}] ${message}`);
      console.log(`[ValueInjector] ${message}`);
    }
  }

  /**
   * Get all logs
   */
  public getLogs(): string[] {
    return [...this.logs];
  }

  /**
   * Clear logs
   */
  public clearLogs(): void {
    this.logs = [];
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a ValueInjector instance
 * 
 * @param fieldMappings - Array of Field objects from CSV mapping
 * @param config - Optional configuration
 * @returns Configured ValueInjector
 */
export function createValueInjector(
  fieldMappings: Field[],
  config?: Partial<ValueInjectorConfig>
): ValueInjector {
  return new ValueInjector(fieldMappings, config);
}

// ============================================================================
// STANDALONE INJECTION FUNCTION
// ============================================================================

/**
 * Quick injection without creating an instance
 * 
 * @param row - CSV row data
 * @param steps - Steps to inject into
 * @param fieldMappings - Field mappings
 * @param config - Optional configuration
 * @returns Batch injection result
 */
export function injectValues(
  row: CsvRow,
  steps: Step[],
  fieldMappings: Field[],
  config?: Partial<ValueInjectorConfig>
): BatchInjectionResult {
  const injector = new ValueInjector(fieldMappings, config);
  return injector.injectRow(row, steps);
}
