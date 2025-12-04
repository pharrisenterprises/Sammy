/**
 * Core Module Verification Tests
 * @module core/core.verification.test
 * 
 * Comprehensive verification that all core module exports
 * are properly configured and functional.
 */

import { describe, it, expect, afterEach } from 'vitest';

// Import everything from the master barrel export
import * as Core from './index';

// ============================================================================
// EXPORT VERIFICATION
// ============================================================================

describe('Core Module Export Verification', () => {
  afterEach(() => {
    Core.resetAllSingletons();
  });
  
  describe('Types Module Exports', () => {
    it('should export Step types and factories', () => {
      expect(Core.createStep).toBeDefined();
      expect(Core.STEP_EVENTS).toBeDefined();
      expect(Core.isStepEvent).toBeDefined();
      expect(Core.generateStepId).toBeDefined();
    });
    
    it('should export Project types and factories', () => {
      expect(Core.createProject).toBeDefined();
      expect(Core.PROJECT_STATUSES).toBeDefined();
      expect(Core.isProjectStatus).toBeDefined();
      expect(Core.toProjectSummary).toBeDefined();
    });
    
    it('should export TestRun types and factories', () => {
      expect(Core.createTestRun).toBeDefined();
      expect(Core.TEST_RUN_STATUSES).toBeDefined();
      expect(Core.isTestRunStatus).toBeDefined();
      expect(Core.toTestRunSummary).toBeDefined();
    });
    
    it('should export LocatorBundle types and factories', () => {
      expect(Core.createBundle).toBeDefined();
      expect(Core.createMinimalBundle).toBeDefined();
      expect(Core.isLocatorBundle).toBeDefined();
    });
    
    it('should export Field types and factories', () => {
      expect(Core.createField).toBeDefined();
      expect(Core.createMappedField).toBeDefined();
      expect(Core.createUnmappedField).toBeDefined();
      expect(Core.isMappedField).toBeDefined();
    });
  });
  
  describe('Storage Module Exports', () => {
    it('should export storage manager', () => {
      expect(Core.getStorageManager).toBeDefined();
      expect(Core.createIndexedDBStorage).toBeDefined();
      expect(Core.createMemoryStorage).toBeDefined();
      expect(Core.createChromeStorage).toBeDefined();
    });
    
    it('should export storage utilities', () => {
      expect(Core.resetMemoryStorage).toBeDefined();
      expect(Core.resetChromeStorage).toBeDefined();
      expect(Core.resetIndexedDBStorage).toBeDefined();
    });
  });
  
  describe('Replay Module Exports', () => {
    it('should export replay configuration', () => {
      expect(Core.DEFAULT_TIMING_CONFIG).toBeDefined();
      expect(Core.DEFAULT_LOCATOR_CONFIG).toBeDefined();
      expect(Core.DEFAULT_REPLAY_CONFIG).toBeDefined();
    });
    
    it('should export replay state management', () => {
      expect(Core.ReplayStateManager).toBeDefined();
      expect(Core.VALID_TRANSITIONS).toBeDefined();
      expect(Core.formatElapsedTime).toBeDefined();
    });
    
    it('should export element finder', () => {
      expect(Core.ElementFinder).toBeDefined();
      expect(Core.createElementFinder).toBeDefined();
      expect(Core.STRATEGY_CONFIDENCE).toBeDefined();
      expect(Core.DEFAULT_STRATEGY_ORDER).toBeDefined();
    });
    
    it('should export action executor', () => {
      expect(Core.ActionExecutor).toBeDefined();
      expect(Core.createActionExecutor).toBeDefined();
      expect(Core.KEYS).toBeDefined();
    });
    
    it('should export step executor', () => {
      expect(Core.StepExecutor).toBeDefined();
      expect(Core.createStepExecutor).toBeDefined();
      expect(Core.executeStep).toBeDefined();
      expect(Core.executeSteps).toBeDefined();
    });
    
    it('should export replay engine', () => {
      expect(Core.ReplayEngine).toBeDefined();
      expect(Core.createReplayEngine).toBeDefined();
    });
    
    it('should export replay session', () => {
      expect(Core.ReplaySession).toBeDefined();
      expect(Core.createReplaySession).toBeDefined();
    });
  });
  
  describe('Orchestrator Module Exports', () => {
    it('should export orchestrator types', () => {
      expect(Core.ORCHESTRATOR_TRANSITIONS).toBeDefined();
      expect(Core.DEFAULT_ORCHESTRATOR_CONFIG).toBeDefined();
    });
    
    it('should export test orchestrator', () => {
      expect(Core.TestOrchestrator).toBeDefined();
      expect(Core.createTestOrchestrator).toBeDefined();
    });
    
    it('should export tab manager', () => {
      expect(Core.ChromeTabManager).toBeDefined();
      expect(Core.createChromeTabManager).toBeDefined();
      expect(Core.MockTabManager).toBeDefined();
      expect(Core.createMockTabManager).toBeDefined();
    });
  });
  
  describe('Background Module Exports', () => {
    it('should export message types', () => {
      expect(Core.ACTION_CATEGORIES).toBeDefined();
      expect(Core.isStorageAction).toBeDefined();
      expect(Core.isTabAction).toBeDefined();
      expect(Core.createSuccessResponse).toBeDefined();
      expect(Core.createErrorResponse).toBeDefined();
    });
    
    it('should export message router', () => {
      expect(Core.MessageRouter).toBeDefined();
      expect(Core.createMessageRouter).toBeDefined();
      expect(Core.registerHandlers).toBeDefined();
    });
    
    it('should export background tab manager', () => {
      expect(Core.BackgroundTabManager).toBeDefined();
      expect(Core.createBackgroundTabManager).toBeDefined();
      expect(Core.MockBackgroundTabManager).toBeDefined();
    });
  });
  
  describe('CSV Module Exports', () => {
    it('should export CSV parser types', () => {
      expect(Core.SUPPORTED_EXTENSIONS).toBeDefined();
      expect(Core.SUPPORTED_MIME_TYPES).toBeDefined();
      expect(Core.DEFAULT_PARSER_CONFIG).toBeDefined();
      expect(Core.isSupportedFile).toBeDefined();
    });
    
    it('should export CSV parser', () => {
      expect(Core.CSVParser).toBeDefined();
      expect(Core.createCSVParser).toBeDefined();
      expect(Core.createPreviewParser).toBeDefined();
    });
    
    it('should export field mapper', () => {
      expect(Core.FieldMapper).toBeDefined();
      expect(Core.createFieldMapper).toBeDefined();
      expect(Core.diceSimilarity).toBeDefined();
      expect(Core.normalizeString).toBeDefined();
    });
    
    it('should export CSV validator', () => {
      expect(Core.CSVValidator).toBeDefined();
      expect(Core.createCSVValidator).toBeDefined();
      expect(Core.isValidCSVData).toBeDefined();
      expect(Core.hasValidMappings).toBeDefined();
    });
    
    it('should export CSV processing service', () => {
      expect(Core.CSVProcessingService).toBeDefined();
      expect(Core.createCSVProcessingService).toBeDefined();
      expect(Core.createPreviewService).toBeDefined();
      expect(Core.createFullProcessingService).toBeDefined();
    });
    
    it('should export CSV utilities', () => {
      expect(Core.CSV_DEFAULTS).toBeDefined();
      expect(Core.canProcessFile).toBeDefined();
      expect(Core.formatRowCount).toBeDefined();
      expect(Core.formatMappingStatus).toBeDefined();
    });
  });
  
  describe('Content Module Exports', () => {
    it('should export content script types', () => {
      expect(Core.DEFAULT_STEP_TIMEOUT).toBeDefined();
      expect(Core.DEFAULT_NOTIFICATION_DURATION).toBeDefined();
      expect(Core.PAGE_SCRIPT_SOURCE).toBeDefined();
      expect(Core.CONTENT_SCRIPT_SOURCE).toBeDefined();
      expect(Core.INPUT_EVENT_TYPES).toBeDefined();
      expect(Core.CLICK_EVENT_TYPES).toBeDefined();
    });
    
    it('should export context bridge', () => {
      expect(Core.ContextBridge).toBeDefined();
      expect(Core.createContextBridge).toBeDefined();
      expect(Core.MockContextBridge).toBeDefined();
      expect(Core.createMockContextBridge).toBeDefined();
    });
    
    it('should export notification UI', () => {
      expect(Core.NotificationUI).toBeDefined();
      expect(Core.createNotificationUI).toBeDefined();
      expect(Core.MockNotificationUI).toBeDefined();
      expect(Core.createMockNotificationUI).toBeDefined();
    });
    
    it('should export content utilities', () => {
      expect(Core.CONTENT_DEFAULTS).toBeDefined();
      expect(Core.MESSAGE_TYPES).toBeDefined();
      expect(Core.NOTIFICATION_TYPES).toBeDefined();
      expect(Core.formatStepProgress).toBeDefined();
      expect(Core.formatRowProgress).toBeDefined();
    });
  });
  
  describe('UI Module Exports', () => {
    it('should export UI constants', () => {
      expect(Core.DEFAULT_PAGE_SIZE).toBeDefined();
      expect(Core.DEFAULT_LOG_LIMIT).toBeDefined();
      expect(Core.STATUS_COLORS).toBeDefined();
      expect(Core.STATUS_LABELS).toBeDefined();
      expect(Core.LOG_LEVEL_COLORS).toBeDefined();
    });
    
    it('should export UI state manager', () => {
      expect(Core.UIStateManager).toBeDefined();
      expect(Core.createUIStateManager).toBeDefined();
      expect(Core.getUIStateManager).toBeDefined();
      expect(Core.selectors).toBeDefined();
    });
    
    it('should export UI helpers', () => {
      expect(Core.createLoadingState).toBeDefined();
      expect(Core.createErrorState).toBeDefined();
      expect(Core.createLogEntry).toBeDefined();
      expect(Core.formatUIDuration).toBeDefined();
      expect(Core.formatRelativeTime).toBeDefined();
    });
    
    it('should export status helpers', () => {
      expect(Core.isRecordingActive).toBeDefined();
      expect(Core.isTestRunning).toBeDefined();
      expect(Core.isTestTerminal).toBeDefined();
      expect(Core.canStartTest).toBeDefined();
      expect(Core.isStepPassed).toBeDefined();
    });
  });
  
  describe('Core Utilities', () => {
    it('should export version', () => {
      expect(Core.CORE_VERSION).toBe('1.0.0');
    });
    
    it('should export ALL_DEFAULTS with all modules', () => {
      expect(Core.ALL_DEFAULTS.storage).toBeDefined();
      expect(Core.ALL_DEFAULTS.replay).toBeDefined();
      expect(Core.ALL_DEFAULTS.orchestrator).toBeDefined();
      expect(Core.ALL_DEFAULTS.background).toBeDefined();
      expect(Core.ALL_DEFAULTS.csv).toBeDefined();
      expect(Core.ALL_DEFAULTS.content).toBeDefined();
      expect(Core.ALL_DEFAULTS.ui).toBeDefined();
    });
    
    it('should export resetAllSingletons', () => {
      expect(Core.resetAllSingletons).toBeDefined();
      expect(typeof Core.resetAllSingletons).toBe('function');
    });
  });
});

// ============================================================================
// FUNCTIONAL VERIFICATION
// ============================================================================

describe('Core Module Functional Verification', () => {
  afterEach(() => {
    Core.resetAllSingletons();
  });
  
  describe('Type Creation', () => {
    it('should create valid project', () => {
      const project = Core.createProject({
        name: 'Test',
        target_url: 'https://example.com',
      });
      
      expect(project.name).toBe('Test');
      expect(project.target_url).toBe('https://example.com');
      expect(project.status).toBe('draft');
    });
    
    it('should create valid step', () => {
      const bundle = Core.createBundle({
        xpath: '//button',
        tag: 'button',
      });
      
      const step = Core.createStep({
        event: 'click',
        label: 'Button',
        bundle,
      });
      
      expect(step.event).toBe('click');
      expect(step.label).toBe('Button');
      expect(step.bundle).toBeDefined();
    });
    
    it('should create valid test run', () => {
      const testRun = Core.createTestRun({
        project_id: 1,
      });
      
      expect(testRun.project_id).toBe(1);
      expect(testRun.status).toBe('pending');
    });
  });
  
  describe('CSV Processing', () => {
    it('should parse CSV string', () => {
      const parser = Core.createCSVParser();
      const result = parser.parseString('Name,Email\nJohn,john@example.com');
      
      expect(result.success).toBe(true);
      expect(result.data.rows).toHaveLength(1);
      expect(result.data.headers).toContain('Name');
    });
    
    it('should calculate string similarity', () => {
      const similarity = Core.diceSimilarity('hello', 'hallo');
      
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
    });
  });
  
  describe('UI State Management', () => {
    it('should manage loading state', () => {
      const manager = Core.createUIStateManager({ persistTheme: false });
      
      manager.setLoading(true, 'Testing...');
      
      expect(manager.getLoadingState().isLoading).toBe(true);
      expect(manager.getLoadingState().message).toBe('Testing...');
      
      manager.destroy();
    });
    
    it('should manage logs', () => {
      const manager = Core.createUIStateManager({ persistTheme: false });
      
      manager.logInfo('Test message');
      manager.logError('Error message');
      
      expect(manager.getLogs()).toHaveLength(2);
      expect(manager.getLogsByLevel('error')).toHaveLength(1);
      
      manager.destroy();
    });
  });
  
  describe('Message Routing', () => {
    it('should create success response', () => {
      const response = Core.createSuccessResponse({ id: 1 });
      
      expect(response.success).toBe(true);
      expect(response.id).toBe(1);
    });
    
    it('should create error response', () => {
      const response = Core.createErrorResponse('Something failed');
      
      expect(response.success).toBe(false);
      expect(response.error).toBe('Something failed');
    });
  });
  
  describe('Content Script Helpers', () => {
    it('should format step progress', () => {
      expect(Core.formatStepProgress(3, 10)).toBe('Step 3 of 10');
      expect(Core.formatStepProgress(3, 10, 'Login')).toBe('Step 3 of 10: Login');
    });
    
    it('should format row progress', () => {
      expect(Core.formatRowProgress(2, 5, 3, 10)).toBe('Row 2/5 - Step 3/10');
    });
    
    it('should classify event types', () => {
      expect(Core.isInputEventType('input')).toBe(true);
      expect(Core.isInputEventType('click')).toBe(false);
      expect(Core.isClickEventType('click')).toBe(true);
      expect(Core.isClickEventType('input')).toBe(false);
    });
  });
  
  describe('Status Helpers', () => {
    it('should check test execution status', () => {
      expect(Core.isTestRunning('running')).toBe(true);
      expect(Core.isTestRunning('idle')).toBe(false);
      expect(Core.isTestTerminal('completed')).toBe(true);
      expect(Core.canStartTest('idle')).toBe(true);
    });
    
    it('should get status colors', () => {
      expect(Core.getStatusColor('passed')).toBe('green');
      expect(Core.getStatusColor('failed')).toBe('red');
      expect(Core.getStatusColor('unknown')).toBe('gray');
    });
  });
});

// ============================================================================
// CRITICAL VALUES VERIFICATION
// ============================================================================

describe('Critical Values Verification', () => {
  it('should have correct replay defaults', () => {
    expect(Core.ALL_DEFAULTS.replay.findTimeout).toBe(2000);
    expect(Core.ALL_DEFAULTS.replay.retryInterval).toBe(150);
    expect(Core.ALL_DEFAULTS.replay.maxRetries).toBe(13);
    expect(Core.ALL_DEFAULTS.replay.fuzzyThreshold).toBe(0.4);
    expect(Core.ALL_DEFAULTS.replay.boundingBoxThreshold).toBe(200);
  });
  
  it('should have correct CSV defaults', () => {
    expect(Core.ALL_DEFAULTS.csv.similarityThreshold).toBe(0.3);
    expect(Core.ALL_DEFAULTS.csv.previewRowCount).toBe(10);
    expect(Core.ALL_DEFAULTS.csv.maxEmptyCellRatio).toBe(0.5);
    expect(Core.ALL_DEFAULTS.csv.minMappedFields).toBe(1);
  });
  
  it('should have correct content defaults', () => {
    expect(Core.ALL_DEFAULTS.content.stepTimeout).toBe(30000);
    expect(Core.ALL_DEFAULTS.content.notificationDuration).toBe(3000);
  });
  
  it('should have correct UI defaults', () => {
    expect(Core.ALL_DEFAULTS.ui.pageSize).toBe(10);
    expect(Core.ALL_DEFAULTS.ui.logLimit).toBe(500);
    expect(Core.ALL_DEFAULTS.ui.toastDuration).toBe(5000);
    expect(Core.ALL_DEFAULTS.ui.maxToasts).toBe(5);
  });
});
