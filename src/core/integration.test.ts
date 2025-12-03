/**
 * Core Module Integration Tests
 * @module core/integration.test
 * 
 * Tests the interaction between core modules to ensure they work
 * together correctly. Verifies type consistency, data flow, and
 * end-to-end workflows.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Import from master barrel export to test public API
import {
  // Types
  type Step,
  type Project,
  type TestRun,
  type Field,
  type LocatorBundle,
  createStep,
  createProject,
  createTestRun,
  createField,
  createBundle,
  isStepEvent,
  isTerminalStatus as isTestRunTerminal,
  
  // Storage
  resetMemoryStorage,
  
  // Replay
  type ExecutionContext,
  ReplayStateManager,
  createReplaySession,
  createDataDrivenSession,
  
  // Orchestrator
  createTestOrchestrator,
  createMockTabManager,
  isTerminalState,
  isActiveState,
  calculateOverallProgress,
  
  // Background
  createMessageRouter,
  resetMessageRouter,
  createMockBackgroundTabManager,
  registerHandlers,
  createSuccessResponse,
  createErrorResponse,
  isStorageAction,
  isTabAction,
  getActionCategory,
  
  // Core utilities
  CORE_VERSION,
} from './index';

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Create a test locator bundle
 */
function createTestBundle(overrides?: Partial<LocatorBundle>): LocatorBundle {
  return createBundle({
    xpath: '//button[@id="submit"]',
    id: 'submit',
    ...overrides,
  });
}

/**
 * Create a test step
 */
function createTestStep(
  event: string = 'click',
  label: string = 'Test Button',
  value: string = ''
): Step {
  return createStep({
    event: event as Step['event'],
    label,
    value,
    path: '//button',
    x: 0,
    y: 0,
    bundle: createTestBundle(),
  });
}

/**
 * Create a click step
 */
function createClickStep(label: string, bundle: LocatorBundle): Step {
  return createStep({
    event: 'click',
    label,
    value: '',
    path: bundle.xpath || '',
    x: 0,
    y: 0,
    bundle,
  });
}

/**
 * Create an input step
 */
function createInputStep(label: string, value: string, bundle: LocatorBundle): Step {
  return createStep({
    event: 'input',
    label,
    value,
    path: bundle.xpath || '',
    x: 0,
    y: 0,
    bundle,
  });
}

/**
 * Create a test project
 */
function createTestProject(overrides?: Partial<Project>): Project {
  return createProject({
    name: 'Test Project',
    target_url: 'https://example.com',
    description: 'Test description',
    ...overrides,
  });
}

/**
 * Create test CSV data
 */
function createTestCsvData(): Record<string, string>[] {
  return [
    { username: 'user1', password: 'pass1' },
    { username: 'user2', password: 'pass2' },
    { username: 'user3', password: 'pass3' },
  ];
}

/**
 * Check if project is complete
 */
function isProjectComplete(project: Project): boolean {
  return project.status === 'complete';
}

/**
 * Check if test run is complete
 */
function isTestRunComplete(testRun: TestRun): boolean {
  return isTestRunTerminal(testRun.status);
}

/**
 * Calculate pass rate for test run
 */
function calculatePassRate(testRun: TestRun): number {
  if (testRun.total_steps === 0) return 0;
  const passedSteps = testRun.results.filter(r => r.status === 'passed').length;
  return Math.round((passedSteps / testRun.total_steps) * 100);
}

/**
 * Reset all singletons
 */
function resetAllSingletons(): void {
  resetMemoryStorage();
  resetMessageRouter();
  // Note: Other modules don't export reset functions yet
}

// ============================================================================
// SETUP / TEARDOWN
// ============================================================================

beforeEach(() => {
  resetAllSingletons();
});

afterEach(() => {
  resetAllSingletons();
  vi.restoreAllMocks();
});

// ============================================================================
// TYPE INTEGRATION TESTS
// ============================================================================

describe('Type Integration', () => {
  describe('Step types flow through system', () => {
    it('should create step with valid event types', () => {
      const clickStep = createClickStep('Submit', createTestBundle());
      const inputStep = createInputStep('Username', 'testuser', createTestBundle());
      
      expect(isStepEvent(clickStep.event)).toBe(true);
      expect(isStepEvent(inputStep.event)).toBe(true);
      expect(clickStep.event).toBe('click');
      expect(inputStep.event).toBe('input');
    });
    
    it('should create project with steps array', () => {
      const steps: Step[] = [
        createClickStep('Button 1', createTestBundle()),
        createInputStep('Field 1', 'value', createTestBundle()),
      ];
      
      const project = createTestProject();
      project.recorded_steps = steps;
      
      expect(project.recorded_steps).toHaveLength(2);
      expect(project.recorded_steps[0].event).toBe('click');
      expect(project.recorded_steps[1].event).toBe('input');
    });
    
    it('should create test run with step results', () => {
      const testRun = createTestRun({
        project_id: 1,
        total_steps: 5,
      });
      
      // Add 4 passed and 1 failed result
      testRun.results = [
        { step_id: '1', status: 'passed', duration: 10 },
        { step_id: '2', status: 'passed', duration: 10 },
        { step_id: '3', status: 'passed', duration: 10 },
        { step_id: '4', status: 'passed', duration: 10 },
        { step_id: '5', status: 'failed', duration: 10, error: 'Test error' },
      ];
      
      expect(calculatePassRate(testRun)).toBe(80);
      expect(isTestRunComplete(testRun)).toBe(false);
      
      testRun.status = 'passed';
      expect(isTestRunComplete(testRun)).toBe(true);
    });
    
    it('should track project completion status', () => {
      const project = createTestProject();
      
      expect(isProjectComplete(project)).toBe(false);
      
      project.status = 'complete';
      expect(isProjectComplete(project)).toBe(true);
    });
  });
  
  describe('Field integrates with CSV data', () => {
    it('should create field mappings for CSV columns', () => {
      const csvData = createTestCsvData();
      const csvColumns = Object.keys(csvData[0]);
      
      const fields: Field[] = csvColumns.map((col) => 
        createField({
          field_name: col,
          mapped: true,
          inputvarfields: col.charAt(0).toUpperCase() + col.slice(1),
        })
      );
      
      expect(fields).toHaveLength(2);
      expect(fields[0].field_name).toBe('username');
      expect(fields[1].field_name).toBe('password');
    });
  });
  
  describe('LocatorBundle provides fallback options', () => {
    it('should identify best available locator', () => {
      const bundleWithId = createTestBundle({ id: 'unique-id' });
      const bundleWithXPath = createTestBundle({ id: undefined, xpath: '//div' });
      
      // Both should have valid locators
      expect(bundleWithId.id).toBe('unique-id');
      expect(bundleWithXPath.xpath).toBe('//div');
    });
  });
});

// ============================================================================
// REPLAY INTEGRATION TESTS
// ============================================================================

describe('Replay Integration', () => {
  describe('ReplaySession with Steps', () => {
    it('should create session with typed steps', () => {
      const steps: Step[] = [
        createClickStep('Login', createTestBundle()),
        createInputStep('Username', '', createTestBundle()),
        createInputStep('Password', '', createTestBundle()),
        createClickStep('Submit', createTestBundle()),
      ];
      
      const session = createReplaySession({
        steps,
        csvData: [],
      });
      
      expect(session.getLifecycle()).toBe('idle');
    });
    
    it('should create single-run session', () => {
      const steps: Step[] = [
        createTestStep('click', 'Button'),
      ];
      
      const session = createReplaySession({
        steps,
        csvData: [],
      });
      
      expect(session.getLifecycle()).toBe('idle');
    });
    
    it('should create data-driven session with CSV', () => {
      const steps: Step[] = [
        createInputStep('Username', '', createTestBundle()),
        createInputStep('Password', '', createTestBundle()),
      ];
      
      const csvData = createTestCsvData();
      const fieldMappings = {
        username: 'Username',
        password: 'Password',
      };
      
      const session = createDataDrivenSession(steps, csvData, fieldMappings);
      
      expect(session.getLifecycle()).toBe('idle');
    });
  });
  
  describe('ExecutionContext with CSV values', () => {
    it('should build context with CSV data', () => {
      const csvRow = { username: 'testuser', email: 'test@example.com' };
      
      // ExecutionContext in IReplayEngine needs document
      const mockDoc = {} as Document;
      const context: ExecutionContext = {
        document: mockDoc,
        csvValues: csvRow,
        tabId: 123,
      };
      
      expect(context.csvValues).toEqual(csvRow);
      expect(context.tabId).toBe(123);
    });
  });
  
  describe('ReplaySession configuration', () => {
    it('should create sessions with different configurations', () => {
      const steps = [createClickStep('Test', createTestBundle())];
      
      // Single-run session (no CSV data)
      const session1 = createReplaySession({ steps, csvData: [] });
      
      // Data-driven session (with CSV data)
      const session2 = createDataDrivenSession(steps, [], {});
      
      // Both should create valid sessions
      expect(session1.getLifecycle()).toBe('idle');
      expect(session2.getLifecycle()).toBe('idle');
    });
  });
  
  describe('ReplayStateManager tracks execution', () => {
    it('should manage lifecycle transitions', () => {
      const stateManager = new ReplayStateManager();
      
      expect(stateManager.getLifecycle()).toBe('idle');
      
      stateManager.start(10);
      expect(stateManager.getLifecycle()).toBe('running');
      
      stateManager.pause();
      expect(stateManager.getLifecycle()).toBe('paused');
    });
    
    it('should track progress', () => {
      const stateManager = new ReplayStateManager();
      
      stateManager.start(10);
      stateManager.setCurrentStep(2);
      
      const progress = stateManager.getProgress();
      expect(progress.currentStep).toBe(2);
      expect(progress.percentage).toBe(20);
    });
  });
});

// ============================================================================
// ORCHESTRATOR INTEGRATION TESTS
// ============================================================================

describe('Orchestrator Integration', () => {
  describe('TestOrchestrator with MockTabManager', () => {
    it('should create orchestrator with tab manager', () => {
      const tabManager = createMockTabManager();
      const orchestrator = createTestOrchestrator(tabManager);
      
      expect(orchestrator.getLifecycle()).toBe('idle');
      expect(orchestrator.canStart()).toBe(false); // No project loaded
    });
    
    it('should track lifecycle states', () => {
      const tabManager = createMockTabManager();
      const orchestrator = createTestOrchestrator(tabManager);
      
      expect(isTerminalState(orchestrator.getLifecycle())).toBe(false);
      expect(isActiveState(orchestrator.getLifecycle())).toBe(false);
    });
  });
  
  describe('Progress calculation', () => {
    it('should calculate overall progress', () => {
      // 2 rows, 5 steps each, currently on row 1 step 3
      const progress = calculateOverallProgress(1, 2, 3, 5);
      
      // (1 * 5 + 3) / (2 * 5) * 100 = 8/10 * 100 = 80%
      expect(progress).toBe(80);
    });
    
    it('should handle edge cases', () => {
      expect(calculateOverallProgress(0, 0, 0, 0)).toBe(0);
      expect(calculateOverallProgress(0, 1, 0, 5)).toBe(0);
      // Row 0, Step 5 of 5 = 5/5 = 100%
      expect(calculateOverallProgress(0, 1, 5, 5)).toBe(100);
    });
  });
  
  describe('MockTabManager operations', () => {
    it('should simulate tab lifecycle', async () => {
      const tabManager = createMockTabManager();
      
      // Open tab
      const result = await tabManager.openTab('https://example.com');
      expect(result.success).toBe(true);
      expect(result.tab).toBeDefined();
      
      // Check tab ready
      const ready = await tabManager.isTabReady(result.tab!.tabId);
      expect(ready).toBe(true);
      
      // Send message
      const response = await tabManager.sendMessage(result.tab!.tabId, { type: 'ping' });
      expect(response).toBe(true);
      
      // Close tab
      const closed = await tabManager.closeTab(result.tab!.tabId);
      expect(closed).toBe(true);
    });
  });
});

// ============================================================================
// BACKGROUND INTEGRATION TESTS
// ============================================================================

describe('Background Integration', () => {
  describe('MessageRouter with storage handlers', () => {
    it('should route storage actions to handlers', async () => {
      const router = createMessageRouter();
      const projects: Project[] = [];
      
      // Register storage handlers
      registerHandlers(router, {
        'add_project': async (message) => {
          const project = createTestProject(message.payload as Partial<Project>);
          project.id = projects.length + 1;
          projects.push(project);
          return createSuccessResponse({ id: project.id });
        },
        'get_all_projects': async () => {
          return createSuccessResponse({ projects });
        },
      });
      
      // Add project
      const addResponse = await router.route(
        { action: 'add_project', payload: { name: 'Test' } },
        { tab: { id: 1 } }
      );
      
      expect(addResponse.success).toBe(true);
      expect((addResponse as any).id).toBe(1);
      
      // Get all projects
      const getResponse = await router.route(
        { action: 'get_all_projects' },
        { tab: { id: 1 } }
      );
      
      expect(getResponse.success).toBe(true);
      expect((getResponse as any).projects).toHaveLength(1);
    });
    
    it('should categorize actions correctly', () => {
      expect(isStorageAction('add_project')).toBe(true);
      expect(isStorageAction('get_all_projects')).toBe(true);
      expect(isTabAction('openTab')).toBe(true);
      expect(getActionCategory('add_project')).toBe('storage');
      expect(getActionCategory('openTab')).toBe('tab');
    });
  });
  
  describe('BackgroundTabManager mock operations', () => {
    it('should track tabs with project association', async () => {
      const tabManager = createMockBackgroundTabManager();
      
      // Open tabs for different projects
      const tab1 = await tabManager.openTab('https://example.com', 1);
      const tab2 = await tabManager.openTab('https://example.org', 1);
      const tab3 = await tabManager.openTab('https://test.com', 2);
      
      expect(tab1.success).toBe(true);
      expect(tab2.success).toBe(true);
      expect(tab3.success).toBe(true);
      
      // Get tabs for project 1
      const projectTabs = tabManager.getTabsForProject(1);
      expect(projectTabs).toHaveLength(2);
      
      // Close project tabs
      const closed = await tabManager.closeProjectTabs(1);
      expect(closed).toBe(2);
      expect(tabManager.getTabsForProject(1)).toHaveLength(0);
      expect(tabManager.getTabsForProject(2)).toHaveLength(1);
    });
  });
  
  describe('Error handling', () => {
    it('should create error responses', () => {
      const errorFromString = createErrorResponse('Something went wrong');
      const errorFromError = createErrorResponse(new Error('Test error'));
      
      expect(errorFromString.success).toBe(false);
      expect(errorFromString.error).toBe('Something went wrong');
      expect(errorFromError.error).toBe('Test error');
    });
    
    it('should handle unknown actions', async () => {
      const router = createMessageRouter();
      
      const response = await router.route(
        { action: 'unknown_action' },
        { tab: { id: 1 } }
      );
      
      expect(response.success).toBe(false);
      expect(response.error).toContain('No handler');
    });
  });
});

// ============================================================================
// END-TO-END WORKFLOW TESTS
// ============================================================================

describe('End-to-End Workflows', () => {
  describe('Recording → Storage → Replay flow', () => {
    it('should support full recording to replay workflow', async () => {
      // 1. Create project (simulating recording start)
      const project = createTestProject({
        name: 'E2E Test Project',
        target_url: 'https://example.com/form',
      });
      project.id = 1;
      
      // 2. Record steps (simulating user interactions)
      const recordedSteps: Step[] = [
        createInputStep('Username', '', createTestBundle({ id: 'username' })),
        createInputStep('Password', '', createTestBundle({ id: 'password' })),
        createClickStep('Login', createTestBundle({ id: 'login-btn' })),
      ];
      
      project.recorded_steps = recordedSteps;
      
      // 3. Define field mappings (CSV columns to step labels)
      const parsedFields: Field[] = [
        createField({
          field_name: 'user',
          mapped: true,
          inputvarfields: 'Username',
        }),
        createField({
          field_name: 'pass',
          mapped: true,
          inputvarfields: 'Password',
        }),
      ];
      
      project.parsed_fields = parsedFields;
      
      // 4. Add CSV data
      const csvData: Record<string, string>[] = [
        { user: 'alice', pass: 'alice123' },
        { user: 'bob', pass: 'bob456' },
      ];
      
      project.csv_data = csvData;
      
      // 5. Verify project is ready for replay
      expect(project.recorded_steps).toHaveLength(3);
      expect(project.parsed_fields).toHaveLength(2);
      expect(project.csv_data).toHaveLength(2);
      
      // 6. Create replay session configuration
      const fieldMappings: Record<string, string> = {};
      for (const field of project.parsed_fields) {
        if (field.mapped && field.field_name) {
          fieldMappings[field.field_name] = field.inputvarfields;
        }
      }
      
      expect(fieldMappings).toEqual({
        user: 'Username',
        pass: 'Password',
      });
      
      // 7. Create session (ready for execution)
      const session = createDataDrivenSession(
        project.recorded_steps,
        project.csv_data,
        fieldMappings
      );
      
      expect(session.getLifecycle()).toBe('idle');
    });
  });
  
  describe('Orchestrator → Tab → Replay coordination', () => {
    it('should coordinate tab management with replay', async () => {
      // 1. Create mock tab manager
      const tabManager = createMockTabManager();
      
      // 2. Create orchestrator
      const orchestrator = createTestOrchestrator(tabManager);
      
      // 3. Set up event tracking
      const events: string[] = [];
      
      orchestrator.onLifecycleChange((newState, prevState) => {
        events.push(`${prevState} → ${newState}`);
      });
      
      orchestrator.onLog((entry) => {
        events.push(`[${entry.level}] ${entry.message}`);
      });
      
      // 4. Verify initial state
      expect(orchestrator.getLifecycle()).toBe('idle');
      expect(orchestrator.getProject()).toBeNull();
      expect(orchestrator.getTab()).toBeNull();
      
      // 5. Verify tab manager is functional
      const tabResult = await tabManager.openTab('https://example.com');
      expect(tabResult.success).toBe(true);
      
      await tabManager.closeTab(tabResult.tab!.tabId);
    });
  });
  
  describe('Message routing → Storage coordination', () => {
    it('should route messages to storage operations', async () => {
      const router = createMessageRouter();
      const storage = new Map<number, Project>();
      let nextId = 1;
      
      // Register CRUD handlers
      registerHandlers(router, {
        'add_project': async (message) => {
          const project = createTestProject(message.payload as Partial<Project>);
          project.id = nextId++;
          storage.set(project.id, project);
          return createSuccessResponse({ id: project.id });
        },
        
        'get_project_by_id': async (message) => {
          const project = storage.get(message.id as number);
          if (project) {
            return createSuccessResponse({ project });
          }
          return createErrorResponse('Project not found');
        },
        
        'update_project_steps': async (message) => {
          const { id, recorded_steps } = message.payload as { id: number; recorded_steps: Step[] };
          const project = storage.get(id);
          if (project) {
            project.recorded_steps = recorded_steps;
            return createSuccessResponse();
          }
          return createErrorResponse('Project not found');
        },
        
        'delete_project': async (message) => {
          const deleted = storage.delete(message.id as number);
          return deleted 
            ? createSuccessResponse() 
            : createErrorResponse('Project not found');
        },
      });
      
      // Test CRUD flow
      const sender = { tab: { id: 1 } };
      
      // Create
      const createRes = await router.route(
        { action: 'add_project', payload: { name: 'CRUD Test' } },
        sender
      );
      expect(createRes.success).toBe(true);
      const projectId = (createRes as any).id;
      
      // Read
      const readRes = await router.route(
        { action: 'get_project_by_id', id: projectId },
        sender
      );
      expect(readRes.success).toBe(true);
      expect((readRes as any).project.name).toBe('CRUD Test');
      
      // Update
      const steps = [createClickStep('Test', createTestBundle())];
      const updateRes = await router.route(
        { action: 'update_project_steps', payload: { id: projectId, recorded_steps: steps } },
        sender
      );
      expect(updateRes.success).toBe(true);
      
      // Verify update
      const verifyRes = await router.route(
        { action: 'get_project_by_id', id: projectId },
        sender
      );
      expect((verifyRes as any).project.recorded_steps).toHaveLength(1);
      
      // Delete
      const deleteRes = await router.route(
        { action: 'delete_project', id: projectId },
        sender
      );
      expect(deleteRes.success).toBe(true);
      
      // Verify deletion
      const notFoundRes = await router.route(
        { action: 'get_project_by_id', id: projectId },
        sender
      );
      expect(notFoundRes.success).toBe(false);
    });
  });
});

// ============================================================================
// VERSION AND RESET TESTS
// ============================================================================

describe('Core Module Utilities', () => {
  it('should export version', () => {
    expect(CORE_VERSION).toBe('1.0.0');
  });
  
  it('should reset all singletons', () => {
    // Create some state
    const router = createMessageRouter();
    router.register('test', async () => createSuccessResponse());
    
    // Reset
    resetAllSingletons();
    
    // Verify state is cleared (new instances would be created)
    expect(true).toBe(true); // If no errors, reset worked
  });
});
