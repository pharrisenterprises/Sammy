/**
 * FieldMapper - CSV Column to Step Label Mapping
 * @module core/csv/FieldMapper
 * @version 1.0.0
 * 
 * Implements IFieldMapper for auto-mapping CSV columns to recorded step
 * labels using fuzzy string matching with Dice coefficient.
 * 
 * ## Auto-Mapping Algorithm
 * 1. Normalize both CSV headers and step labels
 * 2. Calculate similarity score for each pair
 * 3. Select best match above threshold
 * 4. Provide alternatives for manual adjustment
 * 
 * ## Normalization
 * - Convert to lowercase
 * - Remove spaces, underscores, hyphens
 * - Optionally remove special characters
 * 
 * @example
 * ```typescript
 * const mapper = new FieldMapper();
 * 
 * // Auto-map columns to steps
 * const result = mapper.autoMap(csvHeaders, steps);
 * 
 * // Check similarity
 * const score = mapper.getSimilarity('First Name', 'first_name');
 * // Returns ~1.0 after normalization
 * ```
 */

import type { Step } from '../types/step';
import type { Field } from '../types/field';
import type {
  IFieldMapper,
  FieldMapping,
  MappingSuggestion,
  AutoMapResult,
  CSVParserConfig,
  NormalizationConfig,
} from './ICSVParser';

import {
  DEFAULT_PARSER_CONFIG,
  DEFAULT_NORMALIZATION_CONFIG,
  normalizeString,
  diceSimilarity,
  createFieldMapping,
  calculateMappingStats,
} from './ICSVParser';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Match candidate during auto-mapping
 */
interface MatchCandidate {
  stepLabel: string;
  stepIndex: number;
  score: number;
}

/**
 * Mapping configuration
 */
export interface FieldMapperConfig {
  /** Similarity threshold (0-1, default 0.3) */
  similarityThreshold?: number;
  
  /** Normalization options */
  normalization?: NormalizationConfig;
  
  /** Maximum alternatives to suggest (default 3) */
  maxAlternatives?: number;
  
  /** Minimum score for alternatives (default 0.2) */
  alternativeThreshold?: number;
  
  /** Whether to allow duplicate mappings (default false) */
  allowDuplicates?: boolean;
}

/**
 * Default field mapper configuration
 */
export const DEFAULT_FIELD_MAPPER_CONFIG: Required<FieldMapperConfig> = {
  similarityThreshold: 0.3,
  normalization: DEFAULT_NORMALIZATION_CONFIG,
  maxAlternatives: 3,
  alternativeThreshold: 0.2,
  allowDuplicates: false,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract input step labels from steps array
 * Only input-type steps can be mapped to CSV columns
 */
function extractInputLabels(steps: Step[]): Array<{ label: string; index: number }> {
  const inputEvents = ['input', 'change', 'select', 'autocomplete_input'];
  
  return steps
    .map((step, index) => ({ step, index }))
    .filter(({ step }) => inputEvents.includes(step.event))
    .map(({ step, index }) => ({
      label: step.label || '',
      index,
    }))
    .filter(({ label }) => label.length > 0);
}

/**
 * Find all matches above threshold for a column
 */
function findMatches(
  normalizedColumn: string,
  stepLabels: Array<{ label: string; normalized: string; index: number }>,
  threshold: number
): MatchCandidate[] {
  const matches: MatchCandidate[] = [];
  
  for (const step of stepLabels) {
    const score = diceSimilarity(normalizedColumn, step.normalized);
    
    if (score >= threshold) {
      matches.push({
        stepLabel: step.label,
        stepIndex: step.index,
        score,
      });
    }
  }
  
  // Sort by score descending
  return matches.sort((a, b) => b.score - a.score);
}

/**
 * Check if a step is already mapped
 */
function isStepMapped(
  stepIndex: number,
  mappings: FieldMapping[]
): boolean {
  return mappings.some(m => m.mapped && m.stepIndex === stepIndex);
}

// ============================================================================
// FIELD MAPPER CLASS
// ============================================================================

/**
 * Field mapper for auto-mapping CSV columns to step labels
 */
export class FieldMapper implements IFieldMapper {
  private config: Required<FieldMapperConfig>;
  private parserConfig: Required<CSVParserConfig>;
  
  constructor(config?: Partial<FieldMapperConfig>) {
    this.config = {
      ...DEFAULT_FIELD_MAPPER_CONFIG,
      ...config,
      normalization: {
        ...DEFAULT_FIELD_MAPPER_CONFIG.normalization,
        ...config?.normalization,
      },
    };
    
    // Sync with parser config format
    this.parserConfig = {
      ...DEFAULT_PARSER_CONFIG,
      similarityThreshold: this.config.similarityThreshold,
      normalization: this.config.normalization,
    };
  }
  
  // ==========================================================================
  // AUTO-MAPPING
  // ==========================================================================
  
  /**
   * Auto-map CSV columns to step labels
   */
  autoMap(csvHeaders: string[], steps: Step[]): AutoMapResult {
    const mappings: FieldMapping[] = [];
    const suggestions: MappingSuggestion[] = [];
    const unmapped: string[] = [];
    
    // Extract input step labels
    const inputLabels = extractInputLabels(steps);
    
    if (inputLabels.length === 0) {
      // No input steps to map to
      return {
        mappings: csvHeaders.map(col => createFieldMapping(col)),
        suggestions: [],
        unmapped: csvHeaders,
        stats: calculateMappingStats(csvHeaders.map(col => createFieldMapping(col))),
      };
    }
    
    // Normalize step labels
    const normalizedSteps = inputLabels.map(step => ({
      label: step.label,
      normalized: this.normalize(step.label),
      index: step.index,
    }));
    
    // Process each CSV column
    for (const column of csvHeaders) {
      const normalizedColumn = this.normalize(column);
      
      // Find all matches above alternative threshold
      const matches = findMatches(
        normalizedColumn,
        normalizedSteps,
        this.config.alternativeThreshold
      );
      
      if (matches.length === 0) {
        // No matches found
        mappings.push(createFieldMapping(column));
        unmapped.push(column);
        continue;
      }
      
      // Get best match
      const bestMatch = matches[0];
      
      // Check if above main threshold
      if (bestMatch.score >= this.config.similarityThreshold) {
        // Check for duplicates
        if (!this.config.allowDuplicates && isStepMapped(bestMatch.stepIndex, mappings)) {
          // Step already mapped, add to suggestions instead
          this.addSuggestion(suggestions, column, matches);
          mappings.push(createFieldMapping(column));
          unmapped.push(column);
        } else {
          // Create mapping
          mappings.push(createFieldMapping(column, bestMatch.stepLabel, {
            stepIndex: bestMatch.stepIndex,
            confidence: bestMatch.score,
            autoMapped: true,
          }));
        }
      } else {
        // Below threshold, add suggestions
        this.addSuggestion(suggestions, column, matches);
        mappings.push(createFieldMapping(column));
        unmapped.push(column);
      }
    }
    
    return {
      mappings,
      suggestions,
      unmapped,
      stats: calculateMappingStats(mappings),
    };
  }
  
  /**
   * Add suggestion for a column
   */
  private addSuggestion(
    suggestions: MappingSuggestion[],
    column: string,
    matches: MatchCandidate[]
  ): void {
    if (matches.length === 0) return;
    
    const bestMatch = matches[0];
    const alternatives = matches
      .slice(1, this.config.maxAlternatives + 1)
      .map(m => ({
        label: m.stepLabel,
        confidence: m.score,
        stepIndex: m.stepIndex,
      }));
    
    suggestions.push({
      csvColumn: column,
      suggestedLabel: bestMatch.stepLabel,
      confidence: bestMatch.score,
      stepIndex: bestMatch.stepIndex,
      alternatives: alternatives.length > 0 ? alternatives : undefined,
    });
  }
  
  // ==========================================================================
  // SIMILARITY
  // ==========================================================================
  
  /**
   * Get similarity score between two strings
   */
  getSimilarity(str1: string, str2: string): number {
    const normalized1 = this.normalize(str1);
    const normalized2 = this.normalize(str2);
    
    return diceSimilarity(normalized1, normalized2);
  }
  
  /**
   * Normalize string for comparison
   */
  normalize(str: string): string {
    return normalizeString(str, this.config.normalization);
  }
  
  // ==========================================================================
  // MANUAL MAPPING
  // ==========================================================================
  
  /**
   * Create field mapping manually
   */
  createMapping(
    csvColumn: string,
    stepLabel: string | null,
    stepIndex?: number
  ): FieldMapping {
    if (stepLabel === null) {
      return createFieldMapping(csvColumn);
    }
    
    // Calculate confidence if both values provided
    const confidence = this.getSimilarity(csvColumn, stepLabel);
    
    return createFieldMapping(csvColumn, stepLabel, {
      stepIndex,
      confidence,
      autoMapped: false,
    });
  }
  
  /**
   * Update mapping with new target
   */
  updateMapping(
    mapping: FieldMapping,
    stepLabel: string | null,
    stepIndex?: number
  ): FieldMapping {
    return this.createMapping(mapping.csvColumn, stepLabel, stepIndex);
  }
  
  /**
   * Clear mapping (set to unmapped)
   */
  clearMapping(mapping: FieldMapping): FieldMapping {
    return createFieldMapping(mapping.csvColumn);
  }
  
  // ==========================================================================
  // CONVERSION
  // ==========================================================================
  
  /**
   * Convert mappings to Field array
   */
  toFields(mappings: FieldMapping[]): Field[] {
    return mappings.map((mapping) => ({
      field_name: mapping.stepLabel || mapping.csvColumn,
      mapped: mapping.mapped,
      inputvarfields: mapping.csvColumn,
    }));
  }
  
  /**
   * Convert Field array to mappings
   */
  fromFields(fields: Field[]): FieldMapping[] {
    return fields.map(field => createFieldMapping(
      field.inputvarfields || field.field_name,
      field.mapped ? field.field_name : null,
      {
        stepIndex: undefined,
        confidence: undefined,
        autoMapped: false,
      }
    ));
  }
  
  // ==========================================================================
  // UTILITIES
  // ==========================================================================
  
  /**
   * Get best match for a column from steps
   */
  getBestMatch(
    csvColumn: string,
    steps: Step[]
  ): MappingSuggestion | null {
    const inputLabels = extractInputLabels(steps);
    
    if (inputLabels.length === 0) return null;
    
    const normalizedColumn = this.normalize(csvColumn);
    
    let bestMatch: MatchCandidate | null = null;
    
    for (const step of inputLabels) {
      const normalizedLabel = this.normalize(step.label);
      const score = diceSimilarity(normalizedColumn, normalizedLabel);
      
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = {
          stepLabel: step.label,
          stepIndex: step.index,
          score,
        };
      }
    }
    
    if (!bestMatch) return null;
    
    return {
      csvColumn,
      suggestedLabel: bestMatch.stepLabel,
      confidence: bestMatch.score,
      stepIndex: bestMatch.stepIndex,
    };
  }
  
  /**
   * Get all matches for a column above threshold
   */
  getAllMatches(
    csvColumn: string,
    steps: Step[],
    threshold?: number
  ): MappingSuggestion[] {
    const inputLabels = extractInputLabels(steps);
    const minScore = threshold ?? this.config.alternativeThreshold;
    
    if (inputLabels.length === 0) return [];
    
    const normalizedColumn = this.normalize(csvColumn);
    const normalizedSteps = inputLabels.map(step => ({
      label: step.label,
      normalized: this.normalize(step.label),
      index: step.index,
    }));
    
    const matches = findMatches(normalizedColumn, normalizedSteps, minScore);
    
    return matches.map(match => ({
      csvColumn,
      suggestedLabel: match.stepLabel,
      confidence: match.score,
      stepIndex: match.stepIndex,
    }));
  }
  
  /**
   * Validate mappings for issues
   */
  validateMappings(mappings: FieldMapping[]): {
    valid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];
    
    // Check for no mappings
    const mappedCount = mappings.filter(m => m.mapped).length;
    if (mappedCount === 0) {
      issues.push('No fields are mapped');
    }
    
    // Check for duplicate step mappings
    if (!this.config.allowDuplicates) {
      const stepIndices = mappings
        .filter(m => m.mapped && m.stepIndex !== undefined)
        .map(m => m.stepIndex);
      
      const duplicates = stepIndices.filter(
        (index, i) => stepIndices.indexOf(index) !== i
      );
      
      if (duplicates.length > 0) {
        issues.push(`Duplicate mappings found for step indices: ${[...new Set(duplicates)].join(', ')}`);
      }
    }
    
    // Check for low confidence mappings
    const lowConfidence = mappings.filter(
      m => m.mapped && m.confidence !== undefined && m.confidence < this.config.similarityThreshold
    );
    
    if (lowConfidence.length > 0) {
      issues.push(`${lowConfidence.length} mapping(s) have low confidence scores`);
    }
    
    return {
      valid: issues.length === 0,
      issues,
    };
  }
  
  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================
  
  /**
   * Get configuration (CSVParserConfig format for interface)
   */
  getConfig(): Required<CSVParserConfig> {
    return { ...this.parserConfig };
  }
  
  /**
   * Update configuration
   */
  setConfig(config: Partial<CSVParserConfig>): void {
    if (config.similarityThreshold !== undefined) {
      this.config.similarityThreshold = config.similarityThreshold;
      this.parserConfig.similarityThreshold = config.similarityThreshold;
    }
    
    if (config.normalization) {
      this.config.normalization = {
        ...this.config.normalization,
        ...config.normalization,
      };
      this.parserConfig.normalization = this.config.normalization;
    }
  }
  
  /**
   * Get field mapper specific config
   */
  getMapperConfig(): Required<FieldMapperConfig> {
    return { ...this.config };
  }
  
  /**
   * Update field mapper specific config
   */
  setMapperConfig(config: Partial<FieldMapperConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      normalization: {
        ...this.config.normalization,
        ...config.normalization,
      },
    };
    
    // Sync parser config
    this.parserConfig.similarityThreshold = this.config.similarityThreshold;
    this.parserConfig.normalization = this.config.normalization;
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a FieldMapper
 */
export function createFieldMapper(config?: Partial<FieldMapperConfig>): FieldMapper {
  return new FieldMapper(config);
}

/**
 * Create mapper with strict threshold (0.5)
 */
export function createStrictMapper(): FieldMapper {
  return new FieldMapper({
    similarityThreshold: 0.5,
    alternativeThreshold: 0.3,
  });
}

/**
 * Create mapper with loose threshold (0.2)
 */
export function createLooseMapper(): FieldMapper {
  return new FieldMapper({
    similarityThreshold: 0.2,
    alternativeThreshold: 0.1,
    maxAlternatives: 5,
  });
}

/**
 * Create mapper allowing duplicates
 */
export function createDuplicateAllowingMapper(): FieldMapper {
  return new FieldMapper({
    allowDuplicates: true,
  });
}

// ============================================================================
// SINGLETON
// ============================================================================

let defaultMapper: FieldMapper | null = null;

/**
 * Get default field mapper instance
 */
export function getFieldMapper(): FieldMapper {
  if (!defaultMapper) {
    defaultMapper = new FieldMapper();
  }
  return defaultMapper;
}

/**
 * Reset default field mapper
 */
export function resetFieldMapper(): void {
  defaultMapper = null;
}
