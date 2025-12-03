/**
 * Tests for IUIComponents types and helpers
 * @module core/ui/IUIComponents.test
 */

import { describe, it, expect } from 'vitest';
import {
  // Types
  type LoadingState,
  type ErrorState,
  type LogLevel,
  type LogEntry,
  type ProjectSummary,
  type DashboardStats,
  type RecordingStatus,
  type TestExecutionStatus,
  type StepExecutionStatus,
  type TestProgress,
  
  // Constants
  DEFAULT_PAGE_SIZE,
  DEFAULT_LOG_LIMIT,
  STATUS_COLORS,
  STATUS_LABELS,
  LOG_LEVEL_COLORS,
  LOG_LEVEL_ICONS,
  
  // Helper functions
  createEmptyLoadingState,
  createLoadingState,
  createEmptyErrorState,
  createErrorState,
  createLogEntry,
  createInitialTestProgress,
  createProjectSummary,
  calculateDashboardStats,
  formatDuration,
  formatTimestamp,
  formatRelativeTime,
} from './IUIComponents';

import { createProject } from '../types';
import { createTestRun } from '../types';

// ============================================================================
// CONSTANTS TESTS
// ============================================================================

describe('Constants', () => {
  describe('DEFAULT_PAGE_SIZE', () => {
    it('should be 10', () => {
      expect(DEFAULT_PAGE_SIZE).toBe(10);
    });
  });
  
  describe('DEFAULT_LOG_LIMIT', () => {
    it('should be 500', () => {
      expect(DEFAULT_LOG_LIMIT).toBe(500);
    });
  });
  
  describe('STATUS_COLORS', () => {
    it('should have colors for project statuses', () => {
      expect(STATUS_COLORS.draft).toBe('gray');
      expect(STATUS_COLORS.recording).toBe('blue');
      expect(STATUS_COLORS.completed).toBe('green');
    });
    
    it('should have colors for test statuses', () => {
      expect(STATUS_COLORS.running).toBe('blue');
      expect(STATUS_COLORS.passed).toBe('green');
      expect(STATUS_COLORS.failed).toBe('red');
    });
  });
  
  describe('STATUS_LABELS', () => {
    it('should have labels for all statuses', () => {
      expect(STATUS_LABELS.draft).toBe('Draft');
      expect(STATUS_LABELS.running).toBe('Running');
      expect(STATUS_LABELS.passed).toBe('Passed');
    });
  });
  
  describe('LOG_LEVEL_COLORS', () => {
    it('should have colors for all log levels', () => {
      expect(LOG_LEVEL_COLORS.info).toBe('blue');
      expect(LOG_LEVEL_COLORS.success).toBe('green');
      expect(LOG_LEVEL_COLORS.warning).toBe('yellow');
      expect(LOG_LEVEL_COLORS.error).toBe('red');
      expect(LOG_LEVEL_COLORS.debug).toBe('gray');
    });
  });
  
  describe('LOG_LEVEL_ICONS', () => {
    it('should have icons for all log levels', () => {
      expect(LOG_LEVEL_ICONS.info).toBe('Info');
      expect(LOG_LEVEL_ICONS.success).toBe('CheckCircle');
      expect(LOG_LEVEL_ICONS.error).toBe('XCircle');
    });
  });
});

// ============================================================================
// LOADING STATE TESTS
// ============================================================================

describe('Loading State', () => {
  describe('createEmptyLoadingState', () => {
    it('should create non-loading state', () => {
      const state = createEmptyLoadingState();
      
      expect(state.isLoading).toBe(false);
      expect(state.message).toBeUndefined();
      expect(state.progress).toBeUndefined();
    });
  });
  
  describe('createLoadingState', () => {
    it('should create loading state', () => {
      const state = createLoadingState('Loading projects...');
      
      expect(state.isLoading).toBe(true);
      expect(state.message).toBe('Loading projects...');
    });
    
    it('should include progress', () => {
      const state = createLoadingState('Processing...', 50);
      
      expect(state.progress).toBe(50);
    });
  });
});

// ============================================================================
// ERROR STATE TESTS
// ============================================================================

describe('Error State', () => {
  describe('createEmptyErrorState', () => {
    it('should create no-error state', () => {
      const state = createEmptyErrorState();
      
      expect(state.hasError).toBe(false);
      expect(state.message).toBeUndefined();
    });
  });
  
  describe('createErrorState', () => {
    it('should create error state', () => {
      const state = createErrorState('Something went wrong');
      
      expect(state.hasError).toBe(true);
      expect(state.message).toBe('Something went wrong');
      expect(state.recoverable).toBe(true); // Default
    });
    
    it('should include options', () => {
      const state = createErrorState('Fatal error', {
        code: 'E001',
        recoverable: false,
      });
      
      expect(state.code).toBe('E001');
      expect(state.recoverable).toBe(false);
    });
  });
});

// ============================================================================
// LOG ENTRY TESTS
// ============================================================================

describe('Log Entry', () => {
  describe('createLogEntry', () => {
    it('should create log entry', () => {
      const entry = createLogEntry('info', 'Test started');
      
      expect(entry.id).toMatch(/^log_/);
      expect(entry.timestamp).toBeGreaterThan(0);
      expect(entry.level).toBe('info');
      expect(entry.message).toBe('Test started');
    });
    
    it('should include optional data', () => {
      const entry = createLogEntry('error', 'Step failed', {
        data: { stepIndex: 3 },
        source: 'replay-engine',
      });
      
      expect(entry.data).toEqual({ stepIndex: 3 });
      expect(entry.source).toBe('replay-engine');
    });
    
    it('should generate unique IDs', () => {
      const entry1 = createLogEntry('info', 'Test 1');
      const entry2 = createLogEntry('info', 'Test 2');
      
      expect(entry1.id).not.toBe(entry2.id);
    });
  });
});

// ============================================================================
// TEST PROGRESS TESTS
// ============================================================================

describe('Test Progress', () => {
  describe('createInitialTestProgress', () => {
    it('should create zero progress', () => {
      const progress = createInitialTestProgress();
      
      expect(progress.currentRow).toBe(0);
      expect(progress.totalRows).toBe(0);
      expect(progress.currentStep).toBe(0);
      expect(progress.totalSteps).toBe(0);
      expect(progress.rowsPassed).toBe(0);
      expect(progress.rowsFailed).toBe(0);
      expect(progress.percentage).toBe(0);
      expect(progress.elapsedTime).toBe(0);
    });
  });
});

// ============================================================================
// PROJECT SUMMARY TESTS
// ============================================================================

describe('Project Summary', () => {
  describe('createProjectSummary', () => {
    it('should create summary from project', () => {
      const project = createProject({
        name: 'Test Project',
        target_url: 'https://example.com',
      });
      project.id = 1;
      project.recorded_steps = [
        { event: 'click', label: 'Button', value: '', path: '//button' } as any,
        { event: 'input', label: 'Field', value: '', path: '//input' } as any,
      ];
      
      const summary = createProjectSummary(project);
      
      expect(summary.id).toBe(1);
      expect(summary.name).toBe('Test Project');
      expect(summary.targetUrl).toBe('https://example.com');
      expect(summary.stepCount).toBe(2);
    });
    
    it('should include last test run info', () => {
      const project = createProject({
        name: 'Test',
        target_url: 'https://example.com',
      });
      project.id = 1;
      
      const testRun = createTestRun({
        project_id: 1,
        total_steps: 5,
      });
      testRun.status = 'passed';
      testRun.completed_at = Date.now();
      
      const summary = createProjectSummary(project, testRun);
      
      expect(summary.lastTestStatus).toBe('passed');
      expect(summary.lastTestDate).toBeDefined();
    });
  });
});

// ============================================================================
// DASHBOARD STATS TESTS
// ============================================================================

describe('Dashboard Stats', () => {
  describe('calculateDashboardStats', () => {
    it('should calculate stats from projects and test runs', () => {
      const projects = [
        createProject({ name: 'P1', target_url: 'https://example.com', status: 'draft' }),
        createProject({ name: 'P2', target_url: 'https://example.com', status: 'completed' }),
        createProject({ name: 'P3', target_url: 'https://example.com', status: 'completed' }),
      ];
      
      const testRuns = [
        (() => { const tr = createTestRun({ project_id: 2, total_steps: 5 }); tr.status = 'passed'; return tr; })(),
        (() => { const tr = createTestRun({ project_id: 3, total_steps: 5 }); tr.status = 'failed'; return tr; })(),
        (() => { const tr = createTestRun({ project_id: 3, total_steps: 5 }); tr.status = 'running'; return tr; })(),
      ];
      
      const stats = calculateDashboardStats(projects, testRuns);
      
      expect(stats.totalProjects).toBe(3);
      expect(stats.projectsByStatus.draft).toBe(1);
      expect(stats.projectsByStatus.completed).toBe(2);
      expect(stats.activeTests).toBe(1);
      expect(stats.completedTests).toBe(0); // Only 'completed' status counts
    });
    
    it('should handle empty data', () => {
      const stats = calculateDashboardStats([], []);
      
      expect(stats.totalProjects).toBe(0);
      expect(stats.successRate).toBe(0);
    });
  });
});

// ============================================================================
// FORMATTING TESTS
// ============================================================================

describe('Formatting', () => {
  describe('formatDuration', () => {
    it('should format milliseconds', () => {
      expect(formatDuration(500)).toBe('500ms');
    });
    
    it('should format seconds', () => {
      expect(formatDuration(5000)).toBe('5s');
      expect(formatDuration(45000)).toBe('45s');
    });
    
    it('should format minutes and seconds', () => {
      expect(formatDuration(90000)).toBe('1m 30s');
      expect(formatDuration(300000)).toBe('5m 0s');
    });
    
    it('should format hours', () => {
      expect(formatDuration(3600000)).toBe('1h 0m');
      expect(formatDuration(5400000)).toBe('1h 30m');
    });
  });
  
  describe('formatTimestamp', () => {
    it('should format timestamp as locale string', () => {
      const timestamp = Date.now();
      const formatted = formatTimestamp(timestamp);
      
      expect(formatted).toContain('/'); // Date separator
    });
  });
  
  describe('formatRelativeTime', () => {
    it('should format recent time as just now', () => {
      const now = Date.now();
      expect(formatRelativeTime(now - 30000)).toBe('just now');
    });
    
    it('should format minutes ago', () => {
      const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
      expect(formatRelativeTime(fiveMinutesAgo)).toBe('5m ago');
    });
    
    it('should format hours ago', () => {
      const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
      expect(formatRelativeTime(twoHoursAgo)).toBe('2h ago');
    });
    
    it('should format days ago', () => {
      const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
      expect(formatRelativeTime(threeDaysAgo)).toBe('3d ago');
    });
  });
});

// ============================================================================
// TYPE DEFINITION TESTS
// ============================================================================

describe('Type Definitions', () => {
  describe('LogLevel', () => {
    it('should accept valid log levels', () => {
      const levels: LogLevel[] = ['info', 'success', 'warning', 'error', 'debug'];
      expect(levels).toHaveLength(5);
    });
  });
  
  describe('RecordingStatus', () => {
    it('should accept valid recording statuses', () => {
      const statuses: RecordingStatus[] = ['idle', 'recording', 'paused', 'saving'];
      expect(statuses).toHaveLength(4);
    });
  });
  
  describe('TestExecutionStatus', () => {
    it('should accept valid test execution statuses', () => {
      const statuses: TestExecutionStatus[] = [
        'idle', 'preparing', 'running', 'paused', 
        'completed', 'failed', 'cancelled'
      ];
      expect(statuses).toHaveLength(7);
    });
  });
  
  describe('StepExecutionStatus', () => {
    it('should accept valid step execution statuses', () => {
      const statuses: StepExecutionStatus[] = [
        'pending', 'running', 'passed', 'failed', 'skipped'
      ];
      expect(statuses).toHaveLength(5);
    });
  });
});
