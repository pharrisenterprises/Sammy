/**
 * CSVProcessingService - Unified CSV Processing
 * @module core/csv/CSVProcessingService
 * @version 1.0.0
 * 
 * Combines CSVParser, FieldMapper, and CSVValidator into a unified
 * service for end-to-end CSV processing workflows.
 * 
 * ## Features
 * - File parsing (CSV and Excel)
 * - Auto-mapping to step labels
 * - Data and mapping validation
 * - Statistics tracking
 * - Coordinated configuration
 * 
 * @example
 * ```typescript
 * const service = new CSVProcessingService();
 * 
 * // Process file end-to-end
 * const result = await service.processFile(file, steps);
 * 
 * if (result.parseResult.success && result.validation.valid) {
 *   console.log('Ready for testing!');
 *   console.log('Mapped fields:', result.mappings.filter(m => m.mapped));
 * }
 * ```
 */

import type { Step } from '../types/step';
import type { Field } from '../types/field';
import type {
  ICSVProcessingService,
  CSVData,
  CSVRow,
  ParseResult,
  FieldMapping,
  AutoMapResult,
  ValidationResult,
  CSVParserConfig,
} from './ICSVParser';
import { CSVParser, createCSVParser } from './CSVParser';
import { FieldMapper, createFieldMapper, type FieldMapperConfig } from './FieldMapper';
import { CSVValidator, createCSVValidator, type CSVValidatorConfig } from './CSVValidator';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Processing result from processFile
 */
export interface ProcessingResult {
  /** Parse result with data */
  parseResult: ParseResult;
  
  /** Field mappings (empty if parse failed) */
  mappings: FieldMapping[];
  
  /** Validation result */
  validation: ValidationResult;
  
  /** Processing metadata */
  metadata: {
    /** Processing duration in ms */
    duration: number;
    
    /** Timestamp */
    processedAt: number;
    
    /** File name */
    fileName?: string;
  };
}

/**
 * Service configuration
 */
export interface CSVProcessingServiceConfig {
  /** Parser configuration */
  parser?: Partial<CSVParserConfig>;
  
  /** Mapper configuration */
  mapper?: Partial<FieldMapperConfig>;
  
  /** Validator configuration */
  validator?: Partial<CSVValidatorConfig>;
  
  /** Auto-map on file process (default true) */
  autoMapOnProcess?: boolean;
  
  /** Auto-validate on file process (default true) */
  autoValidateOnProcess?: boolean;
}

/**
 * Default service configuration
 */
export const DEFAULT_SERVICE_CONFIG: Required<CSVProcessingServiceConfig> = {
  parser: {},
  mapper: {},
  validator: {},
  autoMapOnProcess: true,
  autoValidateOnProcess: true,
};

/**
 * Service statistics
 */
export interface ProcessingStats {
  /** Total files processed */
  filesProcessed: number;
  
  /** Total rows parsed */
  totalRowsParsed: number;
  
  /** Total mappings created */
  totalMappingsCreated: number;
  
  /** Average mapping confidence */
  avgMappingConfidence: number;
  
  /** Parse error count */
  parseErrors: number;
  
  /** Validation error count */
  validationErrors: number;
}

// ============================================================================
// CSV PROCESSING SERVICE CLASS
// ============================================================================

/**
 * CSV Processing Service implementation
 */
export class CSVProcessingService implements ICSVProcessingService {
  private parser: CSVParser;
  private mapper: FieldMapper;
  private validator: CSVValidator;
  private config: Required<CSVProcessingServiceConfig>;
  
  private stats: ProcessingStats = {
    filesProcessed: 0,
    totalRowsParsed: 0,
    totalMappingsCreated: 0,
    avgMappingConfidence: 0,
    parseErrors: 0,
    validationErrors: 0,
  };
  
  private confidenceSum = 0;
  private mappingCount = 0;
  
  constructor(config?: Partial<CSVProcessingServiceConfig>) {
    this.config = {
      ...DEFAULT_SERVICE_CONFIG,
      ...config,
    };
    
    this.parser = createCSVParser(this.config.parser);
    this.mapper = createFieldMapper(this.config.mapper);
    this.validator = createCSVValidator(this.config.validator);
  }
  
  // ==========================================================================
  // ICSVParser IMPLEMENTATION
  // ==========================================================================
  
  /**
   * Parse a file to CSV data
   */
  async parseFile(file: File): Promise<ParseResult> {
    const result = await this.parser.parseFile(file);
    
    if (result.success && result.data) {
      this.stats.totalRowsParsed += result.data.rowCount;
    } else {
      this.stats.parseErrors++;
    }
    
    return result;
  }
  
  /**
   * Parse CSV string content
   */
  parseString(content: string, fileName?: string): ParseResult {
    const result = this.parser.parseString(content, fileName);
    
    if (result.success && result.data) {
      this.stats.totalRowsParsed += result.data.rowCount;
    } else {
      this.stats.parseErrors++;
    }
    
    return result;
  }
  
  /**
   * Extract headers from CSV data
   */
  extractHeaders(data: CSVData): string[] {
    return this.parser.extractHeaders(data);
  }
  
  /**
   * Get preview rows
   */
  preview(data: CSVData, rowCount?: number): CSVRow[] {
    return this.parser.preview(data, rowCount);
  }
  
  // ==========================================================================
  // IFieldMapper IMPLEMENTATION
  // ==========================================================================
  
  /**
   * Auto-map CSV columns to step labels
   */
  autoMap(csvHeaders: string[], steps: Step[]): AutoMapResult {
    const result = this.mapper.autoMap(csvHeaders, steps);
    
    // Track statistics
    const mapped = result.mappings.filter(m => m.mapped);
    this.stats.totalMappingsCreated += mapped.length;
    
    for (const mapping of mapped) {
      if (mapping.confidence !== undefined) {
        this.confidenceSum += mapping.confidence;
        this.mappingCount++;
      }
    }
    
    this.updateAvgConfidence();
    
    return result;
  }
  
  /**
   * Get similarity score between two strings
   */
  getSimilarity(str1: string, str2: string): number {
    return this.mapper.getSimilarity(str1, str2);
  }
  
  /**
   * Normalize string for comparison
   */
  normalize(str: string): string {
    return this.mapper.normalize(str);
  }
  
  /**
   * Create field mapping manually
   */
  createMapping(
    csvColumn: string,
    stepLabel: string | null,
    stepIndex?: number
  ): FieldMapping {
    const mapping = this.mapper.createMapping(csvColumn, stepLabel, stepIndex);
    
    if (mapping.mapped) {
      this.stats.totalMappingsCreated++;
      if (mapping.confidence !== undefined) {
        this.confidenceSum += mapping.confidence;
        this.mappingCount++;
        this.updateAvgConfidence();
      }
    }
    
    return mapping;
  }
  
  /**
   * Convert mappings to Field array
   */
  toFields(mappings: FieldMapping[]): Field[] {
    return this.mapper.toFields(mappings);
  }
  
  // ==========================================================================
  // ICSVValidator IMPLEMENTATION
  // ==========================================================================
  
  /**
   * Validate parsed CSV data
   */
  validateData(data: CSVData): ValidationResult {
    const result = this.validator.validateData(data);
    
    if (!result.valid) {
      this.stats.validationErrors += result.errors.length;
    }
    
    return result;
  }
  
  /**
   * Validate field mappings
   */
  validateMappings(
    mappings: FieldMapping[],
    data: CSVData
  ): ValidationResult {
    const result = this.validator.validateMappings(mappings, data);
    
    if (!result.valid) {
      this.stats.validationErrors += result.errors.length;
    }
    
    return result;
  }
  
  /**
   * Validate complete setup (data + mappings)
   */
  validate(
    data: CSVData,
    mappings: FieldMapping[]
  ): ValidationResult {
    const result = this.validator.validate(data, mappings);
    
    if (!result.valid) {
      this.stats.validationErrors += result.errors.length;
    }
    
    return result;
  }
  
  /**
   * Check if mapping has duplicates
   */
  hasDuplicateMappings(mappings: FieldMapping[]): boolean {
    return this.validator.hasDuplicateMappings(mappings);
  }
  
  /**
   * Get empty cells in data
   */
  getEmptyCells(data: CSVData): Array<{ row: number; column: string }> {
    return this.validator.getEmptyCells(data);
  }
  
  // ==========================================================================
  // ICSVProcessingService IMPLEMENTATION
  // ==========================================================================
  
  /**
   * Process file end-to-end
   */
  async processFile(
    file: File,
    steps: Step[]
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    
    // Parse file
    const parseResult = await this.parseFile(file);
    
    // If parse failed, return early
    if (!parseResult.success || !parseResult.data) {
      const emptyValidation: ValidationResult = {
        valid: false,
        errors: parseResult.errors?.map(e => ({
          type: 'empty_data' as const,
          message: e.message,
        })) || [],
        warnings: [],
        stats: {
          totalRows: 0,
          completeRows: 0,
          incompleteRows: 0,
          mappedColumns: 0,
          unmappedColumns: 0,
          emptyCells: 0,
        },
      };
      
      return {
        parseResult,
        mappings: [],
        validation: emptyValidation,
        metadata: {
          duration: Date.now() - startTime,
          processedAt: Date.now(),
          fileName: file.name,
        },
      };
    }
    
    // Auto-map if configured
    let mappings: FieldMapping[] = [];
    
    if (this.config.autoMapOnProcess) {
      const mapResult = this.autoMap(parseResult.data.headers, steps);
      mappings = mapResult.mappings;
    } else {
      // Create unmapped entries for all columns
      mappings = parseResult.data.headers.map(header => 
        this.mapper.createMapping(header, null)
      );
    }
    
    // Validate if configured
    let validation: ValidationResult;
    
    if (this.config.autoValidateOnProcess) {
      validation = this.validate(parseResult.data, mappings);
    } else {
      validation = {
        valid: true,
        errors: [],
        warnings: [],
        stats: this.validator.calculateStats(parseResult.data, mappings),
      };
    }
    
    this.stats.filesProcessed++;
    
    return {
      parseResult,
      mappings,
      validation,
      metadata: {
        duration: Date.now() - startTime,
        processedAt: Date.now(),
        fileName: file.name,
      },
    };
  }
  
  /**
   * Process CSV content end-to-end
   */
  processContent(
    content: string,
    steps: Step[],
    fileName?: string
  ): ProcessingResult {
    const startTime = Date.now();
    
    // Parse content
    const parseResult = this.parseString(content, fileName);
    
    // If parse failed, return early
    if (!parseResult.success || !parseResult.data) {
      const emptyValidation: ValidationResult = {
        valid: false,
        errors: parseResult.errors?.map(e => ({
          type: 'empty_data' as const,
          message: e.message,
        })) || [],
        warnings: [],
        stats: {
          totalRows: 0,
          completeRows: 0,
          incompleteRows: 0,
          mappedColumns: 0,
          unmappedColumns: 0,
          emptyCells: 0,
        },
      };
      
      return {
        parseResult,
        mappings: [],
        validation: emptyValidation,
        metadata: {
          duration: Date.now() - startTime,
          processedAt: Date.now(),
          fileName,
        },
      };
    }
    
    // Auto-map if configured
    let mappings: FieldMapping[];
    
    if (this.config.autoMapOnProcess) {
      const mapResult = this.autoMap(parseResult.data.headers, steps);
      mappings = mapResult.mappings;
    } else {
      mappings = parseResult.data.headers.map(header => 
        this.mapper.createMapping(header, null)
      );
    }
    
    // Validate if configured
    let validation: ValidationResult;
    
    if (this.config.autoValidateOnProcess) {
      validation = this.validate(parseResult.data, mappings);
    } else {
      validation = {
        valid: true,
        errors: [],
        warnings: [],
        stats: this.validator.calculateStats(parseResult.data, mappings),
      };
    }
    
    this.stats.filesProcessed++;
    
    return {
      parseResult,
      mappings,
      validation,
      metadata: {
        duration: Date.now() - startTime,
        processedAt: Date.now(),
        fileName,
      },
    };
  }
  
  // ==========================================================================
  // STATISTICS
  // ==========================================================================
  
  /**
   * Get processing statistics
   */
  getStats(): ProcessingStats {
    return { ...this.stats };
  }
  
  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      filesProcessed: 0,
      totalRowsParsed: 0,
      totalMappingsCreated: 0,
      avgMappingConfidence: 0,
      parseErrors: 0,
      validationErrors: 0,
    };
    this.confidenceSum = 0;
    this.mappingCount = 0;
    
    // Reset component stats
    this.parser.resetStats();
  }
  
  /**
   * Update average confidence
   */
  private updateAvgConfidence(): void {
    this.stats.avgMappingConfidence = this.mappingCount > 0
      ? this.confidenceSum / this.mappingCount
      : 0;
  }
  
  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================
  
  /**
   * Get parser configuration
   */
  getConfig(): Required<CSVParserConfig> {
    return this.parser.getConfig();
  }
  
  /**
   * Update parser configuration
   */
  setConfig(config: Partial<CSVParserConfig>): void {
    this.parser.setConfig(config);
    this.mapper.setConfig(config);
  }
  
  /**
   * Get service configuration
   */
  getServiceConfig(): Required<CSVProcessingServiceConfig> {
    return { ...this.config };
  }
  
  /**
   * Update service configuration
   */
  setServiceConfig(config: Partial<CSVProcessingServiceConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
    
    if (config.parser) {
      this.parser.setConfig(config.parser);
    }
    
    if (config.mapper) {
      this.mapper.setMapperConfig(config.mapper);
    }
    
    if (config.validator) {
      this.validator.setConfig(config.validator);
    }
  }
  
  // ==========================================================================
  // COMPONENT ACCESS
  // ==========================================================================
  
  /**
   * Get parser instance
   */
  getParser(): CSVParser {
    return this.parser;
  }
  
  /**
   * Get mapper instance
   */
  getMapper(): FieldMapper {
    return this.mapper;
  }
  
  /**
   * Get validator instance
   */
  getValidator(): CSVValidator {
    return this.validator;
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a CSVProcessingService
 */
export function createCSVProcessingService(
  config?: Partial<CSVProcessingServiceConfig>
): CSVProcessingService {
  return new CSVProcessingService(config);
}

/**
 * Create service optimized for quick preview
 */
export function createPreviewService(): CSVProcessingService {
  return new CSVProcessingService({
    parser: {
      previewRowCount: 10,
      maxRows: 100,
    },
    validator: {
      requireMapping: false,
      warnOnEmptyCells: true,
    },
    autoMapOnProcess: true,
    autoValidateOnProcess: false,
  });
}

/**
 * Create service for full processing
 */
export function createFullProcessingService(): CSVProcessingService {
  return new CSVProcessingService({
    parser: {
      maxRows: 0, // No limit
      trimValues: true,
      skipEmptyRows: true,
    },
    mapper: {
      similarityThreshold: 0.3,
      maxAlternatives: 5,
    },
    validator: {
      requireMapping: true,
      minMappedFields: 1,
      warnOnEmptyCells: true,
    },
    autoMapOnProcess: true,
    autoValidateOnProcess: true,
  });
}

/**
 * Create service with strict validation
 */
export function createStrictService(): CSVProcessingService {
  return new CSVProcessingService({
    mapper: {
      similarityThreshold: 0.5,
      allowDuplicates: false,
    },
    validator: {
      requireMapping: true,
      minMappedFields: 1,
      requireAllColumnsMapped: true,
      maxEmptyCellRatio: 0.1,
    },
    autoMapOnProcess: true,
    autoValidateOnProcess: true,
  });
}

// ============================================================================
// SINGLETON
// ============================================================================

let defaultService: CSVProcessingService | null = null;

/**
 * Get default service instance
 */
export function getCSVProcessingService(): CSVProcessingService {
  if (!defaultService) {
    defaultService = new CSVProcessingService();
  }
  return defaultService;
}

/**
 * Reset default service
 */
export function resetCSVProcessingService(): void {
  defaultService = null;
}
