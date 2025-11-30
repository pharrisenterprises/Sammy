/**
 * @fileoverview Storage utility functions for data management
 * @module core/storage/storage-utils
 * @version 1.0.0
 * 
 * This module provides utility functions for storage operations including:
 * - Data export/import (JSON format)
 * - Data validation and sanitization
 * - Chrome storage sync for settings
 * - Storage size estimation
 * - Data compression utilities
 * 
 * @see PHASE_4_SPECIFICATIONS.md Section 3 for storage specifications
 * @see storage-layer_breakdown.md for architecture details
 */

import type { Project, TestRun } from '../types';
import { Database } from './db';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Export data format
 */
export interface ExportData {
  /** Export format version */
  version: string;
  /** Export timestamp */
  exportedAt: number;
  /** Application name */
  application: string;
  /** Projects data */
  projects: Project[];
  /** Test runs data */
  testRuns: TestRun[];
  /** Metadata */
  metadata: {
    projectCount: number;
    testRunCount: number;
    totalSteps: number;
    totalFields: number;
  };
}

/**
 * Import result
 */
export interface ImportResult {
  success: boolean;
  projectsImported: number;
  testRunsImported: number;
  errors: string[];
  warnings: string[];
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Storage statistics
 */
export interface StorageStats {
  projectCount: number;
  testRunCount: number;
  totalSteps: number;
  totalFields: number;
  estimatedSizeBytes: number;
  estimatedSizeFormatted: string;
}

/**
 * Chrome sync storage settings
 */
export interface SyncSettings {
  /** Auto-save interval in ms */
  autoSaveInterval?: number;
  /** Maximum test runs to keep per project */
  maxTestRunsPerProject?: number;
  /** Enable debug logging */
  debugLogging?: boolean;
  /** Default project status */
  defaultProjectStatus?: 'draft' | 'testing' | 'complete';
  /** Theme preference */
  theme?: 'light' | 'dark' | 'system';
  /** Last sync timestamp */
  lastSyncAt?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Current export format version
 */
export const EXPORT_VERSION = '1.0.0';

/**
 * Application identifier for exports
 */
export const APPLICATION_NAME = 'SammyTestRecorder';

/**
 * Chrome sync storage key
 */
export const SYNC_STORAGE_KEY = 'sammyTestRecorderSettings';

/**
 * Default sync settings
 */
export const DEFAULT_SYNC_SETTINGS: SyncSettings = {
  autoSaveInterval: 5000,
  maxTestRunsPerProject: 50,
  debugLogging: false,
  defaultProjectStatus: 'draft',
  theme: 'system'
};

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

/**
 * Export all data to JSON format
 * 
 * @returns Promise resolving to export data
 * 
 * @example
 * ```typescript
 * const exportData = await exportAllData();
 * const json = JSON.stringify(exportData, null, 2);
 * downloadAsFile(json, 'backup.json');
 * ```
 */
export async function exportAllData(): Promise<ExportData> {
  const db = await Database.getInstance();
  const projects = await db.getAllProjects();
  const testRuns = await db.getAllTestRuns();

  // Calculate metadata
  let totalSteps = 0;
  let totalFields = 0;

  for (const project of projects) {
    totalSteps += project.recorded_steps?.length ?? 0;
    totalFields += project.parsed_fields?.length ?? 0;
  }

  return {
    version: EXPORT_VERSION,
    exportedAt: Date.now(),
    application: APPLICATION_NAME,
    projects,
    testRuns,
    metadata: {
      projectCount: projects.length,
      testRunCount: testRuns.length,
      totalSteps,
      totalFields
    }
  };
}

/**
 * Export a single project with its test runs
 * 
 * @param projectId - Project ID to export
 * @returns Promise resolving to export data for single project
 */
export async function exportProject(projectId: number): Promise<ExportData | null> {
  const db = await Database.getInstance();
  const project = await db.getProject(projectId);

  if (!project) {
    return null;
  }

  const testRuns = await db.getTestRunsByProject(projectId);

  return {
    version: EXPORT_VERSION,
    exportedAt: Date.now(),
    application: APPLICATION_NAME,
    projects: [project],
    testRuns,
    metadata: {
      projectCount: 1,
      testRunCount: testRuns.length,
      totalSteps: project.recorded_steps?.length ?? 0,
      totalFields: project.parsed_fields?.length ?? 0
    }
  };
}

/**
 * Convert export data to downloadable JSON string
 * 
 * @param data - Export data
 * @param pretty - Whether to format with indentation
 * @returns JSON string
 */
export function exportToJson(data: ExportData, pretty: boolean = true): string {
  return JSON.stringify(data, null, pretty ? 2 : undefined);
}

/**
 * Create a download blob URL for export data
 * 
 * @param data - Export data or JSON string
 * @returns Blob URL for download
 */
export function createDownloadUrl(data: ExportData | string): string {
  const json = typeof data === 'string' ? data : exportToJson(data);
  const blob = new Blob([json], { type: 'application/json' });
  return URL.createObjectURL(blob);
}

/**
 * Generate filename for export
 * 
 * @param prefix - Filename prefix
 * @returns Formatted filename with timestamp
 */
export function generateExportFilename(prefix: string = 'sammy-backup'): string {
  const date = new Date();
  const timestamp = date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `${prefix}-${timestamp}.json`;
}

// ============================================================================
// IMPORT FUNCTIONS
// ============================================================================

/**
 * Parse and validate import data from JSON string
 * 
 * @param jsonString - JSON string to parse
 * @returns Parsed export data or null if invalid
 */
export function parseImportData(jsonString: string): ExportData | null {
  try {
    const data = JSON.parse(jsonString);
    
    // Basic structure validation
    if (!data.version || !data.projects || !Array.isArray(data.projects)) {
      return null;
    }

    return data as ExportData;
  } catch {
    return null;
  }
}

/**
 * Validate import data structure
 * 
 * @param data - Data to validate
 * @returns Validation result
 */
export function validateImportData(data: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!data || typeof data !== 'object') {
    errors.push('Invalid data format: expected object');
    return { valid: false, errors, warnings };
  }

  const exportData = data as Record<string, unknown>;

  // Check version
  if (!exportData.version) {
    errors.push('Missing version field');
  } else if (exportData.version !== EXPORT_VERSION) {
    warnings.push(`Version mismatch: expected ${EXPORT_VERSION}, got ${exportData.version}`);
  }

  // Check application
  if (exportData.application && exportData.application !== APPLICATION_NAME) {
    warnings.push(`Different application: ${exportData.application}`);
  }

  // Check projects
  if (!Array.isArray(exportData.projects)) {
    errors.push('Missing or invalid projects array');
  } else {
    for (let i = 0; i < exportData.projects.length; i++) {
      const project = exportData.projects[i];
      if (!validateProjectData(project)) {
        errors.push(`Invalid project at index ${i}`);
      }
    }
  }

  // Check test runs (optional)
  if (exportData.testRuns !== undefined) {
    if (!Array.isArray(exportData.testRuns)) {
      errors.push('Invalid testRuns: expected array');
    } else {
      for (let i = 0; i < exportData.testRuns.length; i++) {
        const testRun = exportData.testRuns[i];
        if (!validateTestRunData(testRun)) {
          errors.push(`Invalid test run at index ${i}`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Import data into the database
 * 
 * @param data - Export data to import
 * @param overwrite - Whether to clear existing data first
 * @returns Import result
 */
export async function importData(
  data: ExportData,
  overwrite: boolean = false
): Promise<ImportResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let projectsImported = 0;
  let testRunsImported = 0;

  // Validate first
  const validation = validateImportData(data);
  if (!validation.valid) {
    return {
      success: false,
      projectsImported: 0,
      testRunsImported: 0,
      errors: validation.errors,
      warnings: validation.warnings
    };
  }
  warnings.push(...validation.warnings);

  try {
    const db = await Database.getInstance();

    // Clear existing data if requested
    if (overwrite) {
      await db.clearAll();
    }

    // Import projects
    for (const project of data.projects) {
      try {
        // Remove id to let database assign new one
        const { id, ...projectData } = project;
        await db.addProject(projectData);
        projectsImported++;
      } catch (error) {
        errors.push(`Failed to import project "${project.name}": ${error}`);
      }
    }

    // Import test runs
    if (data.testRuns) {
      for (const testRun of data.testRuns) {
        try {
          await db.addTestRun(testRun);
          testRunsImported++;
        } catch (error) {
          errors.push(`Failed to import test run "${testRun.id}": ${error}`);
        }
      }
    }

    return {
      success: errors.length === 0,
      projectsImported,
      testRunsImported,
      errors,
      warnings
    };
  } catch (error) {
    return {
      success: false,
      projectsImported,
      testRunsImported,
      errors: [...errors, `Import failed: ${error}`],
      warnings
    };
  }
}

/**
 * Import from JSON string
 * 
 * @param jsonString - JSON string to import
 * @param overwrite - Whether to clear existing data
 * @returns Import result
 */
export async function importFromJson(
  jsonString: string,
  overwrite: boolean = false
): Promise<ImportResult> {
  const data = parseImportData(jsonString);

  if (!data) {
    return {
      success: false,
      projectsImported: 0,
      testRunsImported: 0,
      errors: ['Failed to parse JSON data'],
      warnings: []
    };
  }

  return importData(data, overwrite);
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate project data structure
 */
function validateProjectData(data: unknown): boolean {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const project = data as Record<string, unknown>;

  // Required fields
  if (typeof project.name !== 'string' || project.name.length === 0) {
    return false;
  }
  if (typeof project.target_url !== 'string') {
    return false;
  }

  // Status validation
  const validStatuses = ['draft', 'testing', 'complete'];
  if (project.status && !validStatuses.includes(project.status as string)) {
    return false;
  }

  // Steps validation (if present)
  if (project.recorded_steps !== undefined) {
    if (!Array.isArray(project.recorded_steps)) {
      return false;
    }
    for (const step of project.recorded_steps) {
      if (!validateStepData(step)) {
        return false;
      }
    }
  }

  // Fields validation (if present)
  if (project.parsed_fields !== undefined) {
    if (!Array.isArray(project.parsed_fields)) {
      return false;
    }
    for (const field of project.parsed_fields) {
      if (!validateFieldData(field)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Validate test run data structure
 */
function validateTestRunData(data: unknown): boolean {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const testRun = data as Record<string, unknown>;

  // Required fields
  if (typeof testRun.id !== 'string' || testRun.id.length === 0) {
    return false;
  }
  if (typeof testRun.project_id !== 'number') {
    return false;
  }

  // Status validation
  const validStatuses = ['pending', 'running', 'passed', 'failed', 'stopped'];
  if (testRun.status && !validStatuses.includes(testRun.status as string)) {
    return false;
  }

  // Logs must be string (CRITICAL)
  if (testRun.logs !== undefined && typeof testRun.logs !== 'string') {
    return false;
  }

  return true;
}

/**
 * Validate step data structure
 */
function validateStepData(data: unknown): boolean {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const step = data as Record<string, unknown>;

  // Required fields
  if (typeof step.id !== 'string') {
    return false;
  }

  // Event validation
  const validEvents = ['click', 'input', 'enter', 'open'];
  if (!validEvents.includes(step.event as string)) {
    return false;
  }

  return true;
}

/**
 * Validate field data structure
 */
function validateFieldData(data: unknown): boolean {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const field = data as Record<string, unknown>;

  // Required fields (snake_case)
  if (typeof field.field_name !== 'string') {
    return false;
  }
  if (typeof field.mapped !== 'boolean') {
    return false;
  }
  if (typeof field.inputvarfields !== 'string') {
    return false;
  }

  return true;
}

// ============================================================================
// STORAGE STATISTICS
// ============================================================================

/**
 * Get storage statistics
 * 
 * @returns Storage statistics
 */
export async function getStorageStats(): Promise<StorageStats> {
  const db = await Database.getInstance();
  const projects = await db.getAllProjects();
  const testRuns = await db.getAllTestRuns();

  let totalSteps = 0;
  let totalFields = 0;

  for (const project of projects) {
    totalSteps += project.recorded_steps?.length ?? 0;
    totalFields += project.parsed_fields?.length ?? 0;
  }

  // Estimate size
  const estimatedSizeBytes = estimateDataSize(projects, testRuns);

  return {
    projectCount: projects.length,
    testRunCount: testRuns.length,
    totalSteps,
    totalFields,
    estimatedSizeBytes,
    estimatedSizeFormatted: formatBytes(estimatedSizeBytes)
  };
}

/**
 * Estimate data size in bytes
 */
function estimateDataSize(projects: Project[], testRuns: TestRun[]): number {
  // Rough estimation based on JSON serialization
  const projectsJson = JSON.stringify(projects);
  const testRunsJson = JSON.stringify(testRuns);
  
  // Add overhead for IndexedDB storage
  const overhead = 1.2; // 20% overhead estimate
  
  return Math.round((projectsJson.length + testRunsJson.length) * overhead);
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ============================================================================
// CHROME SYNC STORAGE
// ============================================================================

/**
 * Get settings from Chrome sync storage
 * 
 * @returns Promise resolving to sync settings
 */
export async function getSyncSettings(): Promise<SyncSettings> {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage?.sync) {
      // Fallback for non-extension environment
      resolve({ ...DEFAULT_SYNC_SETTINGS });
      return;
    }

    chrome.storage.sync.get(SYNC_STORAGE_KEY, (result) => {
      const stored = result[SYNC_STORAGE_KEY] as SyncSettings | undefined;
      resolve({ ...DEFAULT_SYNC_SETTINGS, ...stored });
    });
  });
}

/**
 * Save settings to Chrome sync storage
 * 
 * @param settings - Settings to save (partial)
 * @returns Promise resolving when saved
 */
export async function saveSyncSettings(settings: Partial<SyncSettings>): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof chrome === 'undefined' || !chrome.storage?.sync) {
      // Fallback for non-extension environment
      resolve();
      return;
    }

    getSyncSettings().then((current) => {
      const updated = {
        ...current,
        ...settings,
        lastSyncAt: Date.now()
      };

      chrome.storage.sync.set({ [SYNC_STORAGE_KEY]: updated }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  });
}

/**
 * Clear all sync settings
 * 
 * @returns Promise resolving when cleared
 */
export async function clearSyncSettings(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof chrome === 'undefined' || !chrome.storage?.sync) {
      resolve();
      return;
    }

    chrome.storage.sync.remove(SYNC_STORAGE_KEY, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

// ============================================================================
// DATA SANITIZATION
// ============================================================================

/**
 * Sanitize project data for storage
 * 
 * Ensures data is in correct format and removes invalid fields.
 * 
 * @param project - Project data to sanitize
 * @returns Sanitized project
 */
export function sanitizeProject(project: Partial<Project>): Partial<Project> {
  const sanitized: Partial<Project> = {};

  // Required string fields
  if (typeof project.name === 'string') {
    sanitized.name = project.name.trim().slice(0, 255);
  }
  if (typeof project.target_url === 'string') {
    sanitized.target_url = project.target_url.trim();
  }
  if (typeof project.description === 'string') {
    sanitized.description = project.description.trim();
  }

  // Status
  const validStatuses = ['draft', 'testing', 'complete'];
  if (validStatuses.includes(project.status as string)) {
    sanitized.status = project.status;
  }

  // Arrays
  if (Array.isArray(project.recorded_steps)) {
    sanitized.recorded_steps = project.recorded_steps.filter(s => validateStepData(s));
  }
  if (Array.isArray(project.parsed_fields)) {
    sanitized.parsed_fields = project.parsed_fields.filter(f => validateFieldData(f));
  }
  if (Array.isArray(project.csv_data)) {
    sanitized.csv_data = project.csv_data;
  }

  // Timestamps
  if (typeof project.created_date === 'number') {
    sanitized.created_date = project.created_date;
  }
  if (typeof project.updated_date === 'number') {
    sanitized.updated_date = project.updated_date;
  }

  // ID (preserve if present)
  if (typeof project.id === 'number') {
    sanitized.id = project.id;
  }

  return sanitized;
}

/**
 * Sanitize test run data for storage
 * 
 * @param testRun - TestRun data to sanitize
 * @returns Sanitized test run
 */
export function sanitizeTestRun(testRun: Partial<TestRun>): Partial<TestRun> {
  const sanitized: Partial<TestRun> = {};

  // Required fields
  if (typeof testRun.id === 'string') {
    sanitized.id = testRun.id;
  }
  if (typeof testRun.project_id === 'number') {
    sanitized.project_id = testRun.project_id;
  }

  // Status
  const validStatuses = ['pending', 'running', 'passed', 'failed', 'stopped'];
  if (validStatuses.includes(testRun.status as string)) {
    sanitized.status = testRun.status;
  }

  // Numeric fields
  if (typeof testRun.total_steps === 'number') {
    sanitized.total_steps = Math.max(0, testRun.total_steps);
  }
  if (typeof testRun.current_step === 'number') {
    sanitized.current_step = Math.max(0, testRun.current_step);
  }
  if (typeof testRun.csv_row_index === 'number') {
    sanitized.csv_row_index = testRun.csv_row_index;
  }

  // CRITICAL: logs must be string, not array
  if (typeof testRun.logs === 'string') {
    sanitized.logs = testRun.logs;
  } else if (Array.isArray(testRun.logs)) {
    // Convert array to string if someone passed wrong type
    sanitized.logs = (testRun.logs as string[]).join('\n');
  }

  // Timestamps (nullable)
  if (testRun.started_at === null || typeof testRun.started_at === 'number') {
    sanitized.started_at = testRun.started_at;
  }
  if (testRun.completed_at === null || typeof testRun.completed_at === 'number') {
    sanitized.completed_at = testRun.completed_at;
  }

  // Error message
  if (testRun.error === null || typeof testRun.error === 'string') {
    sanitized.error = testRun.error;
  }

  // Results array
  if (Array.isArray(testRun.results)) {
    sanitized.results = testRun.results;
  }

  return sanitized;
}

// ============================================================================
// CLEANUP UTILITIES
// ============================================================================

/**
 * Clean up old test runs to free storage space
 * 
 * @param maxAge - Maximum age in days
 * @param maxPerProject - Maximum test runs to keep per project
 * @returns Number of test runs deleted
 */
export async function cleanupOldTestRuns(
  maxAge: number = 30,
  maxPerProject: number = 50
): Promise<number> {
  const db = await Database.getInstance();
  const projects = await db.getAllProjects();
  let totalDeleted = 0;

  const cutoffTime = Date.now() - (maxAge * 24 * 60 * 60 * 1000);

  for (const project of projects) {
    if (!project.id) continue;

    const testRuns = await db.getTestRunsByProject(project.id);
    
    // Sort by started_at descending (newest first)
    testRuns.sort((a: TestRun, b: TestRun) => (b.started_at ?? 0) - (a.started_at ?? 0));

    for (let i = 0; i < testRuns.length; i++) {
      const testRun = testRuns[i];
      const shouldDelete = 
        i >= maxPerProject || // Exceeds max per project
        (testRun.started_at && testRun.started_at < cutoffTime); // Too old

      if (shouldDelete) {
        await db.deleteTestRun(testRun.id);
        totalDeleted++;
      }
    }
  }

  return totalDeleted;
}

/**
 * Vacuum database (clear orphaned data)
 * 
 * Removes test runs that reference non-existent projects.
 * 
 * @returns Number of orphaned records deleted
 */
export async function vacuumDatabase(): Promise<number> {
  const db = await Database.getInstance();
  const projects = await db.getAllProjects();
  const testRuns = await db.getAllTestRuns();
  
  const projectIds = new Set(projects.map((p: Project) => p.id));
  let deleted = 0;

  for (const testRun of testRuns) {
    if (!projectIds.has(testRun.project_id)) {
      await db.deleteTestRun(testRun.id);
      deleted++;
    }
  }

  return deleted;
}
