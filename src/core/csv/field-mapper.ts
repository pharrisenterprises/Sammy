/**
 * @fileoverview CSV field mapping for data-driven testing
 * @module core/csv/field-mapper
 * @version 1.0.0
 * 
 * This module provides field mapping capabilities to connect CSV columns
 * to form fields for data-driven testing.
 * 
 * CRITICAL: Field properties use snake_case:
 * - field_name (NOT fieldName)
 * - mapped (boolean)
 * - inputvarfields (NOT inputVarFields)
 * 
 * @see PHASE_4_SPECIFICATIONS.md for CSV specifications
 * @see csv-processing_breakdown.md for processing details
 */

import type { Field } from '../types';
import type { CsvParseResult } from './csv-parser';
import { getRowAsObject } from './csv-parser';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Mapping between CSV column and form field
 */
export interface FieldMapping {
  /** CSV column header name */
  csvColumn: string;
  /** CSV column index */
  csvColumnIndex: number;
  /** Field name to map to */
  field_name: string;
  /** Whether mapping is active */
  enabled: boolean;
  /** Confidence score of auto-match (0-100) */
  confidence: number;
  /** How mapping was created */
  source: 'auto' | 'manual' | 'suggested';
}

/**
 * Complete mapping configuration
 */
export interface MappingConfiguration {
  /** All mappings */
  mappings: FieldMapping[];
  /** Unmapped CSV columns */
  unmappedColumns: string[];
  /** Unmapped fields */
  unmappedFields: string[];
  /** Whether all required fields are mapped */
  complete: boolean;
  /** Mapping quality score (0-100) */
  qualityScore: number;
}

/**
 * Options for auto-mapping
 */
export interface AutoMapOptions {
  /** Minimum confidence for auto-match (0-100) */
  minConfidence?: number;
  /** Use fuzzy matching */
  fuzzyMatch?: boolean;
  /** Case-insensitive matching */
  caseInsensitive?: boolean;
  /** Custom synonyms for matching */
  synonyms?: Record<string, string[]>;
}

/**
 * Data injection result for a single row
 */
export interface InjectionResult {
  /** Row index in CSV data */
  rowIndex: number;
  /** Field values to inject */
  values: Record<string, string>;
  /** Fields that had no mapping */
  unmappedFields: string[];
  /** Columns that had no mapping */
  unmappedColumns: string[];
}

/**
 * Batch injection result
 */
export interface BatchInjectionResult {
  /** All row results */
  rows: InjectionResult[];
  /** Total rows processed */
  totalRows: number;
  /** Successfully mapped rows */
  successfulRows: number;
  /** Rows with missing data */
  incompleteRows: number;
}

/**
 * Field match candidate
 */
interface MatchCandidate {
  field_name: string;
  score: number;
  reason: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default auto-map options
 */
export const DEFAULT_AUTOMAP_OPTIONS: Required<AutoMapOptions> = {
  minConfidence: 60,
  fuzzyMatch: true,
  caseInsensitive: true,
  synonyms: {
    email: ['e-mail', 'email_address', 'emailaddress', 'mail'],
    phone: ['telephone', 'tel', 'phone_number', 'phonenumber', 'mobile'],
    name: ['full_name', 'fullname', 'username', 'user_name'],
    first_name: ['firstname', 'fname', 'given_name', 'givenname'],
    last_name: ['lastname', 'lname', 'surname', 'family_name'],
    address: ['street', 'street_address', 'addr'],
    city: ['town', 'locality'],
    state: ['province', 'region'],
    zip: ['zipcode', 'zip_code', 'postal', 'postal_code', 'postcode'],
    country: ['nation', 'country_code'],
    password: ['pass', 'pwd', 'secret'],
    company: ['organization', 'org', 'business', 'employer'],
    title: ['job_title', 'position', 'role'],
    date: ['dob', 'birthdate', 'birth_date', 'date_of_birth'],
    ssn: ['social', 'social_security', 'tax_id'],
    amount: ['price', 'cost', 'total', 'value'],
    quantity: ['qty', 'count', 'number']
  }
};

// ============================================================================
// FIELD MAPPER CLASS
// ============================================================================

/**
 * Field Mapper for CSV to form field mapping
 * 
 * @example
 * ```typescript
 * const mapper = new FieldMapper(csvResult, fields);
 * 
 * // Auto-map columns to fields
 * mapper.autoMap();
 * 
 * // Get mapping configuration
 * const config = mapper.getConfiguration();
 * 
 * // Get data for specific row
 * const rowData = mapper.getRowData(0);
 * ```
 */
export class FieldMapper {
  private csvResult: CsvParseResult;
  private fields: Field[];
  private mappings: Map<string, FieldMapping>;
  private options: Required<AutoMapOptions>;

  constructor(
    csvResult: CsvParseResult,
    fields: Field[],
    options: AutoMapOptions = {}
  ) {
    this.csvResult = csvResult;
    this.fields = fields;
    this.mappings = new Map();
    this.options = { ...DEFAULT_AUTOMAP_OPTIONS, ...options };
  }

  // ==========================================================================
  // AUTO-MAPPING
  // ==========================================================================

  /**
   * Automatically map CSV columns to fields
   * 
   * @returns Number of mappings created
   */
  autoMap(): number {
    let mappingCount = 0;

    for (let i = 0; i < this.csvResult.headers.length; i++) {
      const column = this.csvResult.headers[i];
      
      // Skip if already mapped
      if (this.mappings.has(column)) continue;

      // Find best match
      const match = this.findBestMatch(column);
      
      if (match && match.score >= this.options.minConfidence) {
        this.addMapping({
          csvColumn: column,
          csvColumnIndex: i,
          field_name: match.field_name,
          enabled: true,
          confidence: match.score,
          source: match.score >= 90 ? 'auto' : 'suggested'
        });
        mappingCount++;
      }
    }

    return mappingCount;
  }

  /**
   * Find best matching field for a CSV column
   */
  private findBestMatch(column: string): MatchCandidate | null {
    const normalizedColumn = this.normalizeString(column);
    const candidates: MatchCandidate[] = [];

    for (const field of this.fields) {
      // Skip already mapped fields
      if (this.isFieldMapped(field.field_name)) continue;

      const normalizedField = this.normalizeString(field.field_name);
      let score = 0;
      let reason = '';

      // Exact match
      if (normalizedColumn === normalizedField) {
        score = 100;
        reason = 'exact match';
      }
      // Contains match
      else if (normalizedColumn.includes(normalizedField) || 
               normalizedField.includes(normalizedColumn)) {
        score = 80;
        reason = 'contains match';
      }
      // Synonym match
      else if (this.isSynonym(normalizedColumn, normalizedField)) {
        score = 75;
        reason = 'synonym match';
      }
      // Fuzzy match
      else if (this.options.fuzzyMatch) {
        const similarity = this.calculateSimilarity(normalizedColumn, normalizedField);
        if (similarity >= 0.6) {
          score = Math.round(similarity * 70);
          reason = 'fuzzy match';
        }
      }

      if (score > 0) {
        candidates.push({ field_name: field.field_name, score, reason });
      }
    }

    // Return highest scoring candidate
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0] || null;
  }

  /**
   * Check if two strings are synonyms
   */
  private isSynonym(str1: string, str2: string): boolean {
    for (const [key, synonyms] of Object.entries(this.options.synonyms)) {
      const allTerms = [key, ...synonyms];
      const normalizedTerms = allTerms.map(t => this.normalizeString(t));
      
      if (normalizedTerms.includes(str1) && normalizedTerms.includes(str2)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Normalize string for comparison
   */
  private normalizeString(str: string): string {
    if (!this.options.caseInsensitive) return str;
    
    return str
      .toLowerCase()
      .replace(/[-_\s]+/g, '') // Remove separators
      .trim();
  }

  /**
   * Calculate string similarity (Levenshtein-based)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1;
    if (str1.length === 0 || str2.length === 0) return 0;

    const len1 = str1.length;
    const len2 = str2.length;
    const matrix: number[][] = [];

    // Initialize matrix
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    const distance = matrix[len1][len2];
    const maxLen = Math.max(len1, len2);
    return 1 - distance / maxLen;
  }

  // ==========================================================================
  // MANUAL MAPPING
  // ==========================================================================

  /**
   * Add a manual mapping
   */
  addMapping(mapping: FieldMapping): void {
    this.mappings.set(mapping.csvColumn, mapping);
  }

  /**
   * Remove a mapping by CSV column
   */
  removeMapping(csvColumn: string): boolean {
    return this.mappings.delete(csvColumn);
  }

  /**
   * Remove mapping by field name
   */
  removeMappingByField(field_name: string): boolean {
    for (const [column, mapping] of this.mappings) {
      if (mapping.field_name === field_name) {
        return this.mappings.delete(column);
      }
    }
    return false;
  }

  /**
   * Update a mapping
   */
  updateMapping(
    csvColumn: string,
    updates: Partial<Omit<FieldMapping, 'csvColumn' | 'csvColumnIndex'>>
  ): boolean {
    const mapping = this.mappings.get(csvColumn);
    if (!mapping) return false;

    Object.assign(mapping, updates);
    return true;
  }

  /**
   * Enable/disable a mapping
   */
  setMappingEnabled(csvColumn: string, enabled: boolean): boolean {
    return this.updateMapping(csvColumn, { enabled });
  }

  /**
   * Clear all mappings
   */
  clearMappings(): void {
    this.mappings.clear();
  }

  // ==========================================================================
  // MAPPING QUERIES
  // ==========================================================================

  /**
   * Get mapping for CSV column
   */
  getMapping(csvColumn: string): FieldMapping | undefined {
    return this.mappings.get(csvColumn);
  }

  /**
   * Get mapping by field name
   */
  getMappingByField(field_name: string): FieldMapping | undefined {
    for (const mapping of this.mappings.values()) {
      if (mapping.field_name === field_name) {
        return mapping;
      }
    }
    return undefined;
  }

  /**
   * Get all mappings
   */
  getAllMappings(): FieldMapping[] {
    return Array.from(this.mappings.values());
  }

  /**
   * Get enabled mappings only
   */
  getEnabledMappings(): FieldMapping[] {
    return this.getAllMappings().filter(m => m.enabled);
  }

  /**
   * Check if CSV column is mapped
   */
  isColumnMapped(csvColumn: string): boolean {
    const mapping = this.mappings.get(csvColumn);
    return mapping ? mapping.enabled : false;
  }

  /**
   * Check if field is mapped
   */
  isFieldMapped(field_name: string): boolean {
    for (const mapping of this.mappings.values()) {
      if (mapping.field_name === field_name && mapping.enabled) {
        return true;
      }
    }
    return false;
  }

  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================

  /**
   * Get complete mapping configuration
   */
  getConfiguration(): MappingConfiguration {
    const mappings = this.getEnabledMappings();
    const mappedColumns = new Set(mappings.map(m => m.csvColumn));
    const mappedFields = new Set(mappings.map(m => m.field_name));

    const unmappedColumns = this.csvResult.headers.filter(
      h => !mappedColumns.has(h)
    );

    const unmappedFields = this.fields
      .map(f => f.field_name)
      .filter(f => !mappedFields.has(f));

    const qualityScore = this.calculateQualityScore(mappings);

    return {
      mappings,
      unmappedColumns,
      unmappedFields,
      complete: unmappedFields.length === 0,
      qualityScore
    };
  }

  /**
   * Calculate mapping quality score
   */
  private calculateQualityScore(mappings: FieldMapping[]): number {
    if (mappings.length === 0) return 0;
    if (this.fields.length === 0) return 100;

    const fieldCoverage = mappings.length / this.fields.length;
    const avgConfidence = mappings.reduce((sum, m) => sum + m.confidence, 0) / mappings.length;

    return Math.round((fieldCoverage * 60) + (avgConfidence * 0.4));
  }

  // ==========================================================================
  // DATA INJECTION
  // ==========================================================================

  /**
   * Get data for a specific CSV row
   * 
   * @param rowIndex - Row index in CSV data (0-indexed)
   * @returns Injection result with field values
   */
  getRowData(rowIndex: number): InjectionResult | null {
    const rowObj = getRowAsObject(this.csvResult, rowIndex);
    if (!rowObj) return null;

    const values: Record<string, string> = {};
    const usedColumns = new Set<string>();
    const mappedFields = new Set<string>();

    for (const mapping of this.getEnabledMappings()) {
      const value = rowObj[mapping.csvColumn] ?? '';
      values[mapping.field_name] = value;
      usedColumns.add(mapping.csvColumn);
      mappedFields.add(mapping.field_name);
    }

    const unmappedColumns = Object.keys(rowObj).filter(
      col => !usedColumns.has(col)
    );

    const unmappedFields = this.fields
      .map(f => f.field_name)
      .filter(f => !mappedFields.has(f));

    return {
      rowIndex,
      values,
      unmappedFields,
      unmappedColumns
    };
  }

  /**
   * Get data for all CSV rows
   * 
   * @returns Batch injection result
   */
  getAllRowData(): BatchInjectionResult {
    const rows: InjectionResult[] = [];
    let successfulRows = 0;
    let incompleteRows = 0;

    for (let i = 0; i < this.csvResult.rowCount; i++) {
      const result = this.getRowData(i);
      if (result) {
        rows.push(result);
        
        if (result.unmappedFields.length === 0) {
          successfulRows++;
        } else {
          incompleteRows++;
        }
      }
    }

    return {
      rows,
      totalRows: this.csvResult.rowCount,
      successfulRows,
      incompleteRows
    };
  }

  /**
   * Get value for specific field from specific row
   */
  getFieldValue(rowIndex: number, field_name: string): string | null {
    const mapping = this.getMappingByField(field_name);
    if (!mapping || !mapping.enabled) return null;

    const rowObj = getRowAsObject(this.csvResult, rowIndex);
    if (!rowObj) return null;

    return rowObj[mapping.csvColumn] ?? null;
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  /**
   * Get CSV headers
   */
  getHeaders(): string[] {
    return [...this.csvResult.headers];
  }

  /**
   * Get field names
   */
  getFieldNames(): string[] {
    return this.fields.map(f => f.field_name);
  }

  /**
   * Get CSV row count
   */
  getRowCount(): number {
    return this.csvResult.rowCount;
  }

  /**
   * Export mappings as JSON
   */
  exportMappings(): string {
    return JSON.stringify(this.getAllMappings(), null, 2);
  }

  /**
   * Import mappings from JSON
   */
  importMappings(json: string): number {
    try {
      const mappings = JSON.parse(json) as FieldMapping[];
      this.clearMappings();
      
      for (const mapping of mappings) {
        this.addMapping(mapping);
      }

      return mappings.length;
    } catch {
      return 0;
    }
  }
}

// ============================================================================
// STANDALONE FUNCTIONS
// ============================================================================

/**
 * Quick auto-map CSV to fields
 * 
 * @param csvResult - Parsed CSV result
 * @param fields - Fields to map to
 * @param options - Auto-map options
 * @returns Mapping configuration
 */
export function autoMapFields(
  csvResult: CsvParseResult,
  fields: Field[],
  options: AutoMapOptions = {}
): MappingConfiguration {
  const mapper = new FieldMapper(csvResult, fields, options);
  mapper.autoMap();
  return mapper.getConfiguration();
}

/**
 * Create mapper and return data for all rows
 * 
 * @param csvResult - Parsed CSV result
 * @param fields - Fields to map to
 * @returns All row data with auto-mapping applied
 */
export function mapAndExtractData(
  csvResult: CsvParseResult,
  fields: Field[]
): BatchInjectionResult {
  const mapper = new FieldMapper(csvResult, fields);
  mapper.autoMap();
  return mapper.getAllRowData();
}

/**
 * Suggest mappings without applying them
 * 
 * @param csvHeaders - CSV column headers
 * @param fieldNames - Field names to match
 * @returns Array of suggested mappings
 */
export function suggestMappings(
  csvHeaders: string[],
  fieldNames: string[]
): Array<{
  csvColumn: string;
  suggestedField: string | null;
  confidence: number;
}> {
  const fields: Field[] = fieldNames.map(name => ({
    field_name: name,
    mapped: false,
    inputvarfields: ''
  }));

  const mockCsvResult: CsvParseResult = {
    success: true,
    headers: csvHeaders,
    data: [],
    rawData: [csvHeaders],
    rowCount: 0,
    columnCount: csvHeaders.length,
    errors: [],
    metadata: {
      delimiter: ',',
      lineEnding: '\n',
      hasHeaders: true,
      characterCount: 0,
      parseDuration: 0
    }
  };

  const mapper = new FieldMapper(mockCsvResult, fields);
  mapper.autoMap();
  
  return csvHeaders.map(column => {
    const mapping = mapper.getMapping(column);
    
    return {
      csvColumn: column,
      suggestedField: mapping?.field_name ?? null,
      confidence: mapping?.confidence ?? 0
    };
  });
}

/**
 * Validate that all required fields have mappings
 * 
 * @param configuration - Mapping configuration
 * @param requiredFields - List of required field names
 * @returns Validation result
 */
export function validateRequiredMappings(
  configuration: MappingConfiguration,
  requiredFields: string[]
): {
  valid: boolean;
  missingFields: string[];
} {
  const mappedFields = new Set(configuration.mappings.map(m => m.field_name));
  const missingFields = requiredFields.filter(f => !mappedFields.has(f));

  return {
    valid: missingFields.length === 0,
    missingFields
  };
}

/**
 * Create Fields from CSV headers
 * 
 * Useful for initializing fields from CSV without existing field definitions.
 * 
 * @param headers - CSV headers
 * @returns Array of Field objects
 */
export function createFieldsFromHeaders(headers: string[]): Field[] {
  return headers.map(header => ({
    field_name: header,
    mapped: false,
    inputvarfields: ''
  }));
}

/**
 * Get iterator for row data
 * 
 * Memory-efficient iteration over large CSV files.
 */
export function* iterateRowData(
  mapper: FieldMapper
): Generator<InjectionResult> {
  for (let i = 0; i < mapper.getRowCount(); i++) {
    const result = mapper.getRowData(i);
    if (result) {
      yield result;
    }
  }
}
