/**
 * useCsv - React hook for CSV operations
 * @module hooks/useCsv
 * @version 1.0.0
 * 
 * Provides CSV processing interface:
 * - File parsing (CSV and Excel)
 * - Auto-mapping with fuzzy string matching
 * - Manual field mapping
 * - Data validation and preview
 * - Storage integration
 * 
 * @example
 * ```tsx
 * const { 
 *   parseFile,
 *   autoMap,
 *   fields,
 *   csvData,
 *   mappingProgress 
 * } = useCsv({ projectId: 123, stepLabels });
 * ```
 * 
 * @see csv-processing_breakdown.md for processing patterns
 */

import { useState, useCallback, useMemo } from 'react';
import { useStorage, type UseStorageOptions } from './useStorage';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Field mapping
 */
export interface FieldMapping {
  field_name: string;
  mapped: boolean;
  inputvarfields: string; // Step label this field maps to
  confidence?: number; // Auto-mapping confidence (0-1)
  autoMapped?: boolean; // Was this auto-mapped?
}

/**
 * CSV row data
 */
export type CsvRow = Record<string, string>;

/**
 * Parse result
 */
export interface ParseResult {
  success: boolean;
  headers: string[];
  rows: CsvRow[];
  totalRows: number;
  errors: ParseError[];
}

/**
 * Parse error
 */
export interface ParseError {
  row?: number;
  column?: string;
  message: string;
  type: 'parse' | 'validation' | 'format';
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  statistics: CsvStatistics;
}

/**
 * Validation error
 */
export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  field: string;
  message: string;
  affectedRows: number;
}

/**
 * CSV statistics
 */
export interface CsvStatistics {
  totalRows: number;
  totalColumns: number;
  emptyValuesPerColumn: Record<string, number>;
  uniqueValuesPerColumn: Record<string, number>;
}

/**
 * Mapping progress
 */
export interface MappingProgress {
  total: number;
  mapped: number;
  unmapped: number;
  percentage: number;
}

/**
 * Auto-map result
 */
export interface AutoMapResult {
  field: string;
  matchedLabel: string | null;
  confidence: number;
}

/**
 * Hook options
 */
export interface UseCsvOptions extends UseStorageOptions {
  projectId: number;
  stepLabels: string[];
  maxRows?: number;
  maxColumns?: number;
  maxFileSize?: number; // bytes
  previewRows?: number;
  similarityThreshold?: number;
}

/**
 * Default options
 */
export const DEFAULT_CSV_OPTIONS: Partial<UseCsvOptions> = {
  maxRows: 10000,
  maxColumns: 50,
  maxFileSize: 10 * 1024 * 1024, // 10 MB
  previewRows: 10,
  similarityThreshold: 0.3,
};

/**
 * Hook return type
 */
export interface UseCsvReturn {
  // Data
  csvData: CsvRow[];
  headers: string[];
  fields: FieldMapping[];
  previewData: CsvRow[];
  statistics: CsvStatistics | null;
  
  // State
  isLoading: boolean;
  isParsing: boolean;
  isAutoMapping: boolean;
  error: string | null;
  parseErrors: ParseError[];
  validationResult: ValidationResult | null;
  mappingProgress: MappingProgress;
  
  // File operations
  parseFile: (file: File) => Promise<ParseResult>;
  parseCsvText: (text: string) => Promise<ParseResult>;
  clearData: () => void;
  
  // Mapping operations
  autoMap: () => AutoMapResult[];
  setFieldMapping: (fieldName: string, stepLabel: string) => void;
  clearFieldMapping: (fieldName: string) => void;
  clearAllMappings: () => void;
  
  // Validation
  validate: () => ValidationResult;
  
  // Persistence
  saveToProject: () => Promise<boolean>;
  loadFromProject: () => Promise<void>;
  
  // Utilities
  getFieldByName: (name: string) => FieldMapping | undefined;
  getMappedFields: () => FieldMapping[];
  getUnmappedFields: () => FieldMapping[];
  exportMappings: () => ExportedMappings;
  clearError: () => void;
}

/**
 * Exported mappings format
 */
export interface ExportedMappings {
  projectId: number;
  exportedAt: string;
  fields: FieldMapping[];
  statistics: CsvStatistics | null;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * useCsv - Hook for CSV operations
 */
export function useCsv(options: UseCsvOptions): UseCsvReturn {
  const opts = { ...DEFAULT_CSV_OPTIONS, ...options };
  
  // Storage hook
  const storage = useStorage(options);
  
  // State
  const [csvData, setCsvData] = useState<CsvRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fields, setFields] = useState<FieldMapping[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isAutoMapping, setIsAutoMapping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseErrors, setParseErrors] = useState<ParseError[]>([]);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  // ==========================================================================
  // DERIVED STATE
  // ==========================================================================

  /**
   * Preview data (first N rows)
   */
  const previewData = useMemo(() => {
    return csvData.slice(0, opts.previewRows);
  }, [csvData, opts.previewRows]);

  /**
   * Statistics
   */
  const statistics = useMemo((): CsvStatistics | null => {
    if (csvData.length === 0) return null;

    const emptyValuesPerColumn: Record<string, number> = {};
    const uniqueValuesPerColumn: Record<string, number> = {};

    headers.forEach(header => {
      const values = csvData.map(row => row[header] ?? '');
      emptyValuesPerColumn[header] = values.filter(v => v === '').length;
      uniqueValuesPerColumn[header] = new Set(values).size;
    });

    return {
      totalRows: csvData.length,
      totalColumns: headers.length,
      emptyValuesPerColumn,
      uniqueValuesPerColumn,
    };
  }, [csvData, headers]);

  /**
   * Mapping progress
   */
  const mappingProgress = useMemo((): MappingProgress => {
    const total = fields.length;
    const mapped = fields.filter(f => f.mapped).length;
    const unmapped = total - mapped;
    const percentage = total > 0 ? Math.round((mapped / total) * 100) : 0;

    return { total, mapped, unmapped, percentage };
  }, [fields]);

  // ==========================================================================
  // PARSING
  // ==========================================================================

  /**
   * Parse CSV text
   */
  const parseCsvText = useCallback(async (text: string): Promise<ParseResult> => {
    setIsParsing(true);
    setError(null);
    setParseErrors([]);

    try {
      // Dynamic import Papa Parse (tree-shaking friendly)
      const Papa = await import('papaparse');
      
      const result = Papa.default.parse<CsvRow>(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim(),
      });

      const errors: ParseError[] = result.errors.map(e => ({
        row: e.row,
        message: e.message,
        type: 'parse' as const,
      }));

      if (errors.length > 0) {
        setParseErrors(errors);
      }

      const rows = result.data as CsvRow[];
      const extractedHeaders = result.meta.fields ?? [];

      // Validate limits
      if (rows.length > (opts.maxRows ?? 10000)) {
        const limitError: ParseError = {
          message: `File exceeds maximum row limit of ${opts.maxRows}`,
          type: 'validation',
        };
        setParseErrors(prev => [...prev, limitError]);
        setIsParsing(false);
        return { success: false, headers: [], rows: [], totalRows: rows.length, errors: [limitError] };
      }

      if (extractedHeaders.length > (opts.maxColumns ?? 50)) {
        const limitError: ParseError = {
          message: `File exceeds maximum column limit of ${opts.maxColumns}`,
          type: 'validation',
        };
        setParseErrors(prev => [...prev, limitError]);
        setIsParsing(false);
        return { success: false, headers: [], rows: [], totalRows: rows.length, errors: [limitError] };
      }

      // Update state
      setCsvData(rows);
      setHeaders(extractedHeaders);
      
      // Create field mappings
      const newFields: FieldMapping[] = extractedHeaders.map(header => ({
        field_name: header,
        mapped: false,
        inputvarfields: '',
      }));
      setFields(newFields);

      setIsParsing(false);
      return {
        success: errors.length === 0,
        headers: extractedHeaders,
        rows,
        totalRows: rows.length,
        errors,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Parse failed';
      setError(errorMessage);
      setIsParsing(false);
      return {
        success: false,
        headers: [],
        rows: [],
        totalRows: 0,
        errors: [{ message: errorMessage, type: 'parse' }],
      };
    }
  }, [opts.maxRows, opts.maxColumns]);

  /**
   * Parse Excel file
   */
  const parseExcelFile = useCallback(async (file: File): Promise<ParseResult> => {
    try {
      // Dynamic import XLSX (tree-shaking friendly)
      const XLSX = await import('xlsx');
      
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      
      // Use first sheet
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        return {
          success: false,
          headers: [],
          rows: [],
          totalRows: 0,
          errors: [{ message: 'No sheets found in Excel file', type: 'format' }],
        };
      }

      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<CsvRow>(worksheet, { defval: '' });
      
      if (rows.length === 0) {
        return {
          success: false,
          headers: [],
          rows: [],
          totalRows: 0,
          errors: [{ message: 'No data found in Excel file', type: 'validation' }],
        };
      }

      const extractedHeaders = Object.keys(rows[0]);

      // Validate limits
      if (rows.length > (opts.maxRows ?? 10000)) {
        return {
          success: false,
          headers: [],
          rows: [],
          totalRows: rows.length,
          errors: [{ message: `File exceeds maximum row limit of ${opts.maxRows}`, type: 'validation' }],
        };
      }

      // Update state
      setCsvData(rows);
      setHeaders(extractedHeaders);
      
      const newFields: FieldMapping[] = extractedHeaders.map(header => ({
        field_name: header,
        mapped: false,
        inputvarfields: '',
      }));
      setFields(newFields);

      return {
        success: true,
        headers: extractedHeaders,
        rows,
        totalRows: rows.length,
        errors: [],
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Excel parse failed';
      return {
        success: false,
        headers: [],
        rows: [],
        totalRows: 0,
        errors: [{ message: errorMessage, type: 'parse' }],
      };
    }
  }, [opts.maxRows]);

  /**
   * Parse file (CSV or Excel)
   */
  const parseFile = useCallback(async (file: File): Promise<ParseResult> => {
    setIsLoading(true);
    setError(null);
    setParseErrors([]);

    // Check file size
    if (file.size > (opts.maxFileSize ?? 10 * 1024 * 1024)) {
      const sizeError: ParseError = {
        message: `File size exceeds maximum of ${Math.round((opts.maxFileSize ?? 10 * 1024 * 1024) / 1024 / 1024)}MB`,
        type: 'validation',
      };
      setError(sizeError.message);
      setParseErrors([sizeError]);
      setIsLoading(false);
      return { success: false, headers: [], rows: [], totalRows: 0, errors: [sizeError] };
    }

    const fileName = file.name.toLowerCase();
    let result: ParseResult;

    if (fileName.endsWith('.csv')) {
      const text = await file.text();
      result = await parseCsvText(text);
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      result = await parseExcelFile(file);
    } else {
      const formatError: ParseError = {
        message: 'Unsupported file format. Please upload a CSV or Excel file.',
        type: 'format',
      };
      setError(formatError.message);
      setParseErrors([formatError]);
      setIsLoading(false);
      return { success: false, headers: [], rows: [], totalRows: 0, errors: [formatError] };
    }

    if (!result.success) {
      setError(result.errors[0]?.message ?? 'Parse failed');
      setParseErrors(result.errors);
    }

    setIsLoading(false);
    return result;
  }, [opts.maxFileSize, parseCsvText, parseExcelFile]);

  /**
   * Clear all data
   */
  const clearData = useCallback(() => {
    setCsvData([]);
    setHeaders([]);
    setFields([]);
    setError(null);
    setParseErrors([]);
    setValidationResult(null);
  }, []);

  // ==========================================================================
  // AUTO-MAPPING
  // ==========================================================================

  /**
   * Normalize string for comparison
   */
  const normalizeString = useCallback((str: string): string => {
    return str
      .toLowerCase()
      .replace(/[_\-\s]+/g, '') // Remove underscores, hyphens, spaces
      .replace(/[^a-z0-9]/g, ''); // Remove special characters
  }, []);

  /**
   * Calculate string similarity (Dice coefficient approximation)
   */
  const calculateSimilarity = useCallback((str1: string, str2: string): number => {
    const s1 = normalizeString(str1);
    const s2 = normalizeString(str2);

    if (s1 === s2) return 1;
    if (s1.length === 0 || s2.length === 0) return 0;

    // Simple containment check for high confidence
    if (s1.includes(s2) || s2.includes(s1)) {
      return 0.8;
    }

    // Bigram comparison (Dice coefficient)
    const getBigrams = (s: string): Set<string> => {
      const bigrams = new Set<string>();
      for (let i = 0; i < s.length - 1; i++) {
        bigrams.add(s.substring(i, i + 2));
      }
      return bigrams;
    };

    const bigrams1 = getBigrams(s1);
    const bigrams2 = getBigrams(s2);

    let intersection = 0;
    bigrams1.forEach(bigram => {
      if (bigrams2.has(bigram)) intersection++;
    });

    return (2 * intersection) / (bigrams1.size + bigrams2.size);
  }, [normalizeString]);

  /**
   * Auto-map fields to step labels
   */
  const autoMap = useCallback((): AutoMapResult[] => {
    setIsAutoMapping(true);
    const results: AutoMapResult[] = [];
    const threshold = opts.similarityThreshold ?? 0.3;

    const newFields = fields.map(field => {
      let bestMatch: string | null = null;
      let bestScore = 0;

      // Find best matching step label
      opts.stepLabels.forEach(label => {
        const score = calculateSimilarity(field.field_name, label);
        if (score > bestScore && score >= threshold) {
          bestScore = score;
          bestMatch = label;
        }
      });

      results.push({
        field: field.field_name,
        matchedLabel: bestMatch,
        confidence: bestScore,
      });

      if (bestMatch) {
        return {
          ...field,
          mapped: true,
          inputvarfields: bestMatch,
          confidence: bestScore,
          autoMapped: true,
        };
      }

      return field;
    });

    setFields(newFields);
    setIsAutoMapping(false);
    return results;
  }, [fields, opts.stepLabels, opts.similarityThreshold, calculateSimilarity]);

  // ==========================================================================
  // MANUAL MAPPING
  // ==========================================================================

  /**
   * Set field mapping
   */
  const setFieldMapping = useCallback((fieldName: string, stepLabel: string) => {
    setFields(prev => prev.map(field => {
      if (field.field_name === fieldName) {
        return {
          ...field,
          mapped: stepLabel !== '',
          inputvarfields: stepLabel,
          autoMapped: false, // Manual override
          confidence: undefined,
        };
      }
      return field;
    }));
  }, []);

  /**
   * Clear field mapping
   */
  const clearFieldMapping = useCallback((fieldName: string) => {
    setFieldMapping(fieldName, '');
  }, [setFieldMapping]);

  /**
   * Clear all mappings
   */
  const clearAllMappings = useCallback(() => {
    setFields(prev => prev.map(field => ({
      ...field,
      mapped: false,
      inputvarfields: '',
      autoMapped: false,
      confidence: undefined,
    })));
  }, []);

  // ==========================================================================
  // VALIDATION
  // ==========================================================================

  /**
   * Validate CSV data
   */
  const validate = useCallback((): ValidationResult => {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check for empty data
    if (csvData.length === 0) {
      errors.push({
        field: '_file',
        message: 'No data loaded',
        severity: 'error',
      });
    }

    // Check for unmapped fields
    const unmapped = fields.filter(f => !f.mapped);
    if (unmapped.length === fields.length && fields.length > 0) {
      errors.push({
        field: '_mappings',
        message: 'No fields are mapped to steps',
        severity: 'error',
      });
    }

    // Check for empty values per column
    headers.forEach(header => {
      const emptyCount = csvData.filter(row => !row[header] || row[header].trim() === '').length;
      const emptyPercentage = csvData.length > 0 ? (emptyCount / csvData.length) * 100 : 0;

      if (emptyPercentage > 10) {
        warnings.push({
          field: header,
          message: `${emptyPercentage.toFixed(1)}% empty values`,
          affectedRows: emptyCount,
        });
      }
    });

    const result: ValidationResult = {
      valid: errors.length === 0,
      errors,
      warnings,
      statistics: statistics ?? {
        totalRows: 0,
        totalColumns: 0,
        emptyValuesPerColumn: {},
        uniqueValuesPerColumn: {},
      },
    };

    setValidationResult(result);
    return result;
  }, [csvData, fields, headers, statistics]);

  // ==========================================================================
  // PERSISTENCE
  // ==========================================================================

  /**
   * Save to project
   */
  const saveToProject = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);

    // Save CSV data (preview only)
    const csvResponse = await storage.sendMessage('update_project_csv', {
      id: opts.projectId,
      csv_data: previewData,
    });

    if (!csvResponse.success) {
      setError('Failed to save CSV data');
      setIsLoading(false);
      return false;
    }

    // Save field mappings
    const fieldsResponse = await storage.sendMessage('update_project_fields', {
      id: opts.projectId,
      parsed_fields: fields,
    });

    if (!fieldsResponse.success) {
      setError('Failed to save field mappings');
      setIsLoading(false);
      return false;
    }

    setIsLoading(false);
    return true;
  }, [storage.sendMessage, opts.projectId, previewData, fields]);

  /**
   * Load from project
   */
  const loadFromProject = useCallback(async (): Promise<void> => {
    setIsLoading(true);

    const response = await storage.getProject(opts.projectId);

    if (response.success && response.data) {
      const project = response.data.project as {
        csv_data?: CsvRow[];
        parsed_fields?: FieldMapping[];
      };

      if (project.csv_data && project.csv_data.length > 0) {
        setCsvData(project.csv_data);
        const loadedHeaders = Object.keys(project.csv_data[0]);
        setHeaders(loadedHeaders);
      }

      if (project.parsed_fields) {
        setFields(project.parsed_fields);
      }
    }

    setIsLoading(false);
  }, [storage.getProject, opts.projectId]);

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  /**
   * Get field by name
   */
  const getFieldByName = useCallback((name: string): FieldMapping | undefined => {
    return fields.find(f => f.field_name === name);
  }, [fields]);

  /**
   * Get mapped fields
   */
  const getMappedFields = useCallback((): FieldMapping[] => {
    return fields.filter(f => f.mapped);
  }, [fields]);

  /**
   * Get unmapped fields
   */
  const getUnmappedFields = useCallback((): FieldMapping[] => {
    return fields.filter(f => !f.mapped);
  }, [fields]);

  /**
   * Export mappings
   */
  const exportMappings = useCallback((): ExportedMappings => {
    return {
      projectId: opts.projectId,
      exportedAt: new Date().toISOString(),
      fields,
      statistics,
    };
  }, [opts.projectId, fields, statistics]);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // ==========================================================================
  // RETURN
  // ==========================================================================

  return {
    // Data
    csvData,
    headers,
    fields,
    previewData,
    statistics,
    
    // State
    isLoading,
    isParsing,
    isAutoMapping,
    error,
    parseErrors,
    validationResult,
    mappingProgress,
    
    // File operations
    parseFile,
    parseCsvText,
    clearData,
    
    // Mapping operations
    autoMap,
    setFieldMapping,
    clearFieldMapping,
    clearAllMappings,
    
    // Validation
    validate,
    
    // Persistence
    saveToProject,
    loadFromProject,
    
    // Utilities
    getFieldByName,
    getMappedFields,
    getUnmappedFields,
    exportMappings,
    clearError,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create CSV string from data
 */
export function createCsvString(headers: string[], rows: CsvRow[]): string {
  const headerLine = headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',');
  const dataLines = rows.map(row => 
    headers.map(h => `"${(row[h] ?? '').replace(/"/g, '""')}"`).join(',')
  );
  return [headerLine, ...dataLines].join('\n');
}

/**
 * Download CSV file
 */
export function downloadCsv(filename: string, headers: string[], rows: CsvRow[]): void {
  const csv = createCsvString(headers, rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Validate email format
 */
export function isValidEmail(value: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

/**
 * Validate phone format
 */
export function isValidPhone(value: string): boolean {
  const phoneRegex = /^[\d\s\-+()]{10,}$/;
  return phoneRegex.test(value);
}
