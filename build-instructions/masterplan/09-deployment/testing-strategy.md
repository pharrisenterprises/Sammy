# Testing Strategy
**Project:** Chrome Extension Test Recorder  
**Document Version:** 1.0  
**Last Updated:** November 24, 2025  
**Status:** Complete Technical Specification

## Table of Contents
1. Overview
2. Testing Pyramid
3. Unit Testing
4. Integration Testing
5. End-to-End Testing
6. Component Testing
7. Extension-Specific Testing
8. Performance Testing
9. Test Data Management
10. CI/CD Integration
11. Coverage Requirements
12. Testing Tools Reference

---

## 1. Overview

### 1.1 Purpose

This document defines the comprehensive testing strategy for The Automater project, covering all components from the Chrome extension to the web portal and VDI runner. It establishes standards, tools, and procedures for maintaining code quality.

### 1.2 Testing Philosophy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        TESTING PHILOSOPHY                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  PRINCIPLES:                                                            │
│  ─────────────────────────────────────────────────────────────────────  │
│  1. Test Behavior, Not Implementation                                   │
│     └── Focus on what the code does, not how it does it                │
│     └── Tests should survive refactoring                               │
│                                                                         │
│  2. Fast Feedback Loops                                                 │
│     └── Unit tests run in <10 seconds                                  │
│     └── Integration tests run in <2 minutes                            │
│     └── E2E tests run in <10 minutes                                   │
│                                                                         │
│  3. Deterministic Results                                               │
│     └── Same input = same output, always                               │
│     └── No flaky tests in CI                                           │
│     └── Isolated test environments                                     │
│                                                                         │
│  4. Test at the Right Level                                             │
│     └── More unit tests, fewer E2E tests                               │
│     └── Integration tests for boundaries                               │
│     └── E2E tests for critical user journeys                           │
│                                                                         │
│  5. Tests as Documentation                                              │
│     └── Clear test names describe behavior                             │
│     └── Tests show how to use the code                                 │
│     └── Failing tests explain what went wrong                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Testing Scope by Component

| Component | Unit | Integration | E2E | Performance |
|-----------|------|-------------|-----|-------------|
| Recording Engine | ✅ | ✅ | ✅ | ⚪ |
| Replay Engine | ✅ | ✅ | ✅ | ✅ |
| Locator Strategy | ✅ | ✅ | ⚪ | ✅ |
| Storage Layer | ✅ | ✅ | ⚪ | ⚪ |
| Message Bus | ✅ | ✅ | ⚪ | ⚪ |
| UI Components | ✅ | ✅ | ✅ | ⚪ |
| Web Portal | ✅ | ✅ | ✅ | ✅ |
| VDI Runner | ✅ | ✅ | ✅ | ✅ |

---

## 2. Testing Pyramid

### 2.1 Pyramid Structure

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         TESTING PYRAMID                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                        ▲                                                │
│                       /█\    E2E Tests (10%)                            │
│                      / █ \   - Critical user journeys                   │
│                     / █   \  - Cross-browser testing                    │
│                    / █     \ - Slowest, most expensive                  │
│                   ───────────                                           │
│                  /     █     \                                          │
│                 /      █      \  Integration Tests (20%)                │
│                /       █       \ - API contracts                        │
│               /        █        \- Database operations                  │
│              /         █         - Component interactions               │
│             ───────────────────────                                     │
│            /            █            \                                  │
│           /             █             \  Unit Tests (70%)               │
│          /              █              \ - Business logic               │
│         /               █                - Pure functions               │
│        /                █                 - Fast, isolated              │
│       ─────────────────────────────────────                             │
│                                                                         │
│  EXECUTION TIME:                                                        │
│    Unit: ~10 seconds (runs on every save)                              │
│    Integration: ~2 minutes (runs on every commit)                      │
│    E2E: ~10 minutes (runs on PR and main)                              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Test Distribution Goals

| Test Type | Target Count | Coverage Focus |
|-----------|--------------|----------------|
| Unit | 500+ | Business logic, utilities, pure functions |
| Integration | 100+ | API endpoints, database, message passing |
| E2E | 30+ | Critical user flows, cross-component |
| Component | 50+ | React components in isolation |

---

## 3. Unit Testing

### 3.1 Unit Test Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['src/**/*.e2e.{test,spec}.{ts,tsx}', 'node_modules'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    },
    mockReset: true,
    restoreMocks: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
```

### 3.2 Test Setup File

```typescript
// src/test/setup.ts
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Chrome APIs
global.chrome = {
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    },
    getURL: vi.fn((path) => `chrome-extension://test-id/${path}`),
    id: 'test-extension-id'
  },
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn()
    },
    sync: {
      get: vi.fn(),
      set: vi.fn()
    }
  },
  tabs: {
    query: vi.fn(),
    sendMessage: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    onUpdated: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    }
  },
  scripting: {
    executeScript: vi.fn()
  }
} as unknown as typeof chrome;

// Mock IndexedDB
import 'fake-indexeddb/auto';

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}));

// Cleanup after each test
afterEach(() => {
  vi.clearAllMocks();
});
```

### 3.3 Unit Test Examples

```typescript
// src/utils/locator-generator.test.ts
import { describe, it, expect, vi } from 'vitest';
import { generateLocatorBundle } from './locator-generator';

describe('generateLocatorBundle', () => {
  it('should generate ID locator when element has id', () => {
    const element = document.createElement('button');
    element.id = 'submit-btn';
    
    const bundle = generateLocatorBundle(element);
    
    expect(bundle.id).toBe('submit-btn');
  });
  
  it('should generate data-testid locator when present', () => {
    const element = document.createElement('input');
    element.setAttribute('data-testid', 'email-input');
    
    const bundle = generateLocatorBundle(element);
    
    expect(bundle.dataTestId).toBe('email-input');
  });
  
  it('should generate XPath for elements without unique identifiers', () => {
    const container = document.createElement('div');
    container.innerHTML = '<div><span><button>Click me</button></span></div>';
    const button = container.querySelector('button')!;
    
    const bundle = generateLocatorBundle(button);
    
    expect(bundle.xpath).toBeDefined();
    expect(bundle.xpath).toContain('button');
  });
  
  it('should capture bounding box coordinates', () => {
    const element = document.createElement('div');
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
      x: 100,
      y: 200,
      width: 150,
      height: 50,
      top: 200,
      right: 250,
      bottom: 250,
      left: 100,
      toJSON: () => ({})
    });
    
    const bundle = generateLocatorBundle(element);
    
    expect(bundle.bounding).toEqual({
      x: 100,
      y: 200,
      width: 150,
      height: 50
    });
  });
  
  it('should extract aria-label for accessibility', () => {
    const element = document.createElement('button');
    element.setAttribute('aria-label', 'Close dialog');
    
    const bundle = generateLocatorBundle(element);
    
    expect(bundle.ariaLabel).toBe('Close dialog');
  });
});

// src/utils/label-detector.test.ts
import { describe, it, expect } from 'vitest';
import { detectLabel } from './label-detector';

describe('detectLabel', () => {
  it('should detect label from associated label element', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <label for="email">Email Address</label>
      <input id="email" type="email">
    `;
    document.body.appendChild(container);
    
    const input = container.querySelector('input')!;
    const label = detectLabel(input);
    
    expect(label).toBe('Email Address');
    
    document.body.removeChild(container);
  });
  
  it('should detect label from placeholder', () => {
    const input = document.createElement('input');
    input.placeholder = 'Enter your name';
    
    const label = detectLabel(input);
    
    expect(label).toBe('Enter your name');
  });
  
  it('should detect label from aria-label', () => {
    const button = document.createElement('button');
    button.setAttribute('aria-label', 'Submit form');
    
    const label = detectLabel(button);
    
    expect(label).toBe('Submit form');
  });
  
  it('should detect label from button text content', () => {
    const button = document.createElement('button');
    button.textContent = 'Save Changes';
    
    const label = detectLabel(button);
    
    expect(label).toBe('Save Changes');
  });
  
  it('should return fallback for elements without labels', () => {
    const div = document.createElement('div');
    div.className = 'container';
    
    const label = detectLabel(div);
    
    expect(label).toContain('div');
  });
});

// src/storage/project-repository.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProjectRepository } from './project-repository';
import { db } from './database';

describe('ProjectRepository', () => {
  let repository: ProjectRepository;
  
  beforeEach(async () => {
    repository = new ProjectRepository();
    await db.projects.clear();
  });
  
  afterEach(async () => {
    await db.projects.clear();
  });
  
  it('should create a new project', async () => {
    const project = await repository.create({
      name: 'Test Project',
      targetUrl: 'https://example.com'
    });
    
    expect(project.id).toBeDefined();
    expect(project.name).toBe('Test Project');
    expect(project.targetUrl).toBe('https://example.com');
    expect(project.createdDate).toBeInstanceOf(Date);
  });
  
  it('should retrieve a project by ID', async () => {
    const created = await repository.create({
      name: 'Test Project',
      targetUrl: 'https://example.com'
    });
    
    const retrieved = await repository.getById(created.id);
    
    expect(retrieved).toEqual(created);
  });
  
  it('should return null for non-existent project', async () => {
    const result = await repository.getById('non-existent-id');
    
    expect(result).toBeNull();
  });
  
  it('should update a project', async () => {
    const project = await repository.create({
      name: 'Original Name',
      targetUrl: 'https://example.com'
    });
    
    await repository.update(project.id, { name: 'Updated Name' });
    
    const updated = await repository.getById(project.id);
    expect(updated?.name).toBe('Updated Name');
    expect(updated?.updatedDate).not.toEqual(project.updatedDate);
  });
  
  it('should delete a project', async () => {
    const project = await repository.create({
      name: 'To Delete',
      targetUrl: 'https://example.com'
    });
    
    await repository.delete(project.id);
    
    const result = await repository.getById(project.id);
    expect(result).toBeNull();
  });
  
  it('should list all projects sorted by updated date', async () => {
    await repository.create({ name: 'Project A', targetUrl: 'https://a.com' });
    await repository.create({ name: 'Project B', targetUrl: 'https://b.com' });
    await repository.create({ name: 'Project C', targetUrl: 'https://c.com' });
    
    const projects = await repository.listAll();
    
    expect(projects).toHaveLength(3);
    // Most recently updated first
    expect(projects[0].name).toBe('Project C');
  });
});
```

### 3.4 Mocking Patterns

```typescript
// src/test/mocks/supabase.ts
import { vi } from 'vitest';

export const mockSupabaseClient = {
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis()
  })),
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    signInWithPassword: vi.fn(),
    signOut: vi.fn()
  },
  storage: {
    from: vi.fn(() => ({
      upload: vi.fn().mockResolvedValue({ data: { path: 'test/path' }, error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/image.png' } })
    }))
  }
};

// Usage in tests
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient)
}));

// src/test/mocks/chrome-messages.ts
export function mockChromeMessage<T>(
  action: string,
  response: T
): void {
  const sendMessage = chrome.runtime.sendMessage as ReturnType<typeof vi.fn>;
  sendMessage.mockImplementation((message, callback) => {
    if (message.action === action) {
      callback?.(response);
      return Promise.resolve(response);
    }
  });
}

// Usage
mockChromeMessage('getProject', { id: '123', name: 'Test' });
```

---

## 4. Integration Testing

### 4.1 Integration Test Configuration

```typescript
// vitest.integration.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.integration.{test,spec}.ts'],
    setupFiles: ['./src/test/integration-setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: 'forks',  // Isolate tests
    poolOptions: {
      forks: {
        singleFork: true  // Run sequentially for DB tests
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
```

### 4.2 Database Integration Tests

```typescript
// src/storage/database.integration.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

describe('Database Integration', () => {
  let supabase: SupabaseClient;
  let testUserId: string;
  
  beforeAll(async () => {
    // Use test database
    supabase = createClient(
      process.env.TEST_SUPABASE_URL!,
      process.env.TEST_SUPABASE_SERVICE_KEY!
    );
    
    // Create test user
    const { data } = await supabase.auth.admin.createUser({
      email: `test-${Date.now()}@example.com`,
      password: 'test-password-123'
    });
    testUserId = data.user!.id;
  });
  
  afterAll(async () => {
    // Cleanup test user and related data
    if (testUserId) {
      await supabase.from('projects').delete().eq('user_id', testUserId);
      await supabase.auth.admin.deleteUser(testUserId);
    }
  });
  
  beforeEach(async () => {
    // Clear test data between tests
    await supabase.from('projects').delete().eq('user_id', testUserId);
  });
  
  describe('Projects CRUD', () => {
    it('should create a project with all fields', async () => {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          user_id: testUserId,
          name: 'Integration Test Project',
          target_url: 'https://example.com',
          recorded_steps: [
            { stepNumber: 1, event: 'click', label: 'Click button' }
          ]
        })
        .select()
        .single();
      
      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.name).toBe('Integration Test Project');
      expect(data.recorded_steps).toHaveLength(1);
    });
    
    it('should enforce RLS - user cannot access other users projects', async () => {
      // Create project as test user
      await supabase.from('projects').insert({
        user_id: testUserId,
        name: 'Private Project'
      });
      
      // Try to access with anon key (simulating different user)
      const anonClient = createClient(
        process.env.TEST_SUPABASE_URL!,
        process.env.TEST_SUPABASE_ANON_KEY!
      );
      
      const { data, error } = await anonClient
        .from('projects')
        .select('*')
        .eq('user_id', testUserId);
      
      // Should return empty due to RLS
      expect(data).toHaveLength(0);
    });
    
    it('should update project and change updated_date', async () => {
      const { data: created } = await supabase
        .from('projects')
        .insert({
          user_id: testUserId,
          name: 'Original Name'
        })
        .select()
        .single();
      
      // Wait a bit to ensure timestamp difference
      await new Promise(r => setTimeout(r, 100));
      
      const { data: updated } = await supabase
        .from('projects')
        .update({ name: 'Updated Name' })
        .eq('id', created.id)
        .select()
        .single();
      
      expect(updated.name).toBe('Updated Name');
      expect(new Date(updated.updated_date).getTime())
        .toBeGreaterThan(new Date(created.updated_date).getTime());
    });
  });
  
  describe('Test Runs', () => {
    let projectId: string;
    
    beforeEach(async () => {
      const { data } = await supabase
        .from('projects')
        .insert({
          user_id: testUserId,
          name: 'Test Run Project'
        })
        .select()
        .single();
      projectId = data.id;
    });
    
    it('should create test run with status transitions', async () => {
      // Create queued run
      const { data: run } = await supabase
        .from('test_runs')
        .insert({
          project_id: projectId,
          status: 'queued'
        })
        .select()
        .single();
      
      expect(run.status).toBe('queued');
      
      // Update to running
      await supabase
        .from('test_runs')
        .update({ 
          status: 'running',
          started_at: new Date().toISOString()
        })
        .eq('id', run.id);
      
      // Update to completed
      const { data: completed } = await supabase
        .from('test_runs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          passed_steps: 10,
          total_steps: 10,
          pass_rate: 100
        })
        .eq('id', run.id)
        .select()
        .single();
      
      expect(completed.status).toBe('completed');
      expect(completed.pass_rate).toBe(100);
    });
  });
});
```

### 4.3 API Integration Tests

```typescript
// src/api/projects.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createMocks } from 'node-mocks-http';
import { GET, POST, PUT, DELETE } from '@/app/api/projects/route';

describe('Projects API', () => {
  let authToken: string;
  let testProjectId: string;
  
  beforeAll(async () => {
    // Get auth token for test user
    const response = await fetch(`${process.env.TEST_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'apikey': process.env.TEST_SUPABASE_ANON_KEY!
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'test-password'
      })
    });
    const data = await response.json();
    authToken = data.access_token;
  });
  
  describe('POST /api/projects', () => {
    it('should create a new project', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: {
          name: 'API Test Project',
          targetUrl: 'https://example.com'
        }
      });
      
      await POST(req);
      
      expect(res._getStatusCode()).toBe(201);
      const data = JSON.parse(res._getData());
      expect(data.name).toBe('API Test Project');
      testProjectId = data.id;
    });
    
    it('should return 401 without auth token', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: { name: 'Unauthorized' }
      });
      
      await POST(req);
      
      expect(res._getStatusCode()).toBe(401);
    });
    
    it('should return 400 for invalid data', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
        body: { }  // Missing required name
      });
      
      await POST(req);
      
      expect(res._getStatusCode()).toBe(400);
    });
  });
  
  describe('GET /api/projects', () => {
    it('should list user projects', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      await GET(req);
      
      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(Array.isArray(data)).toBe(true);
    });
  });
  
  describe('PUT /api/projects/[id]', () => {
    it('should update project', async () => {
      const { req, res } = createMocks({
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${authToken}` },
        query: { id: testProjectId },
        body: { name: 'Updated Project Name' }
      });
      
      await PUT(req);
      
      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.name).toBe('Updated Project Name');
    });
  });
  
  describe('DELETE /api/projects/[id]', () => {
    it('should delete project', async () => {
      const { req, res } = createMocks({
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` },
        query: { id: testProjectId }
      });
      
      await DELETE(req);
      
      expect(res._getStatusCode()).toBe(204);
    });
  });
});
```

### 4.4 Message Bus Integration Tests

```typescript
// src/messaging/message-bus.integration.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageBus } from './message-bus';
import { BackgroundService } from '../background/service';

describe('Message Bus Integration', () => {
  let messageBus: MessageBus;
  let backgroundService: BackgroundService;
  
  beforeEach(() => {
    messageBus = new MessageBus();
    backgroundService = new BackgroundService(messageBus);
  });
  
  it('should route messages to correct handlers', async () => {
    const handler = vi.fn().mockResolvedValue({ success: true });
    messageBus.register('testAction', handler);
    
    const response = await messageBus.send({ action: 'testAction', data: { foo: 'bar' } });
    
    expect(handler).toHaveBeenCalledWith({ foo: 'bar' });
    expect(response).toEqual({ success: true });
  });
  
  it('should handle async handlers correctly', async () => {
    messageBus.register('asyncAction', async (data) => {
      await new Promise(r => setTimeout(r, 100));
      return { processed: data.value * 2 };
    });
    
    const response = await messageBus.send({ action: 'asyncAction', data: { value: 5 } });
    
    expect(response).toEqual({ processed: 10 });
  });
  
  it('should propagate handler errors', async () => {
    messageBus.register('errorAction', async () => {
      throw new Error('Handler failed');
    });
    
    await expect(
      messageBus.send({ action: 'errorAction', data: {} })
    ).rejects.toThrow('Handler failed');
  });
  
  it('should handle unknown actions gracefully', async () => {
    const response = await messageBus.send({ action: 'unknownAction', data: {} });
    
    expect(response).toEqual({ error: 'Unknown action: unknownAction' });
  });
});
```

---

## 5. End-to-End Testing

### 5.1 Playwright Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results.json' }]
  ],
  
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] }
    }
  ],
  
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  }
});
```

### 5.2 E2E Test Examples

```typescript
// e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should allow user to sign up', async ({ page }) => {
    await page.goto('/register');
    
    await page.fill('[name="email"]', `test-${Date.now()}@example.com`);
    await page.fill('[name="password"]', 'TestPassword123!');
    await page.fill('[name="confirmPassword"]', 'TestPassword123!');
    await page.click('button[type="submit"]');
    
    // Should show success message
    await expect(page.locator('text=Check your email')).toBeVisible();
  });
  
  test('should allow user to log in', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('[name="email"]', 'existing-user@example.com');
    await page.fill('[name="password"]', 'ExistingPassword123!');
    await page.click('button[type="submit"]');
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('text=Welcome back')).toBeVisible();
  });
  
  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('[name="email"]', 'wrong@example.com');
    await page.fill('[name="password"]', 'WrongPassword');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=Invalid login credentials')).toBeVisible();
  });
});

// e2e/project-management.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Project Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });
  
  test('should create a new project', async ({ page }) => {
    await page.click('text=+ New Project');
    
    await page.fill('[name="name"]', 'E2E Test Project');
    await page.fill('[name="targetUrl"]', 'https://example.com');
    await page.fill('[name="description"]', 'Created by E2E test');
    await page.click('button[type="submit"]');
    
    // Should redirect to project detail
    await expect(page).toHaveURL(/\/dashboard\/[\w-]+/);
    await expect(page.locator('h1')).toContainText('E2E Test Project');
  });
  
  test('should edit project steps', async ({ page }) => {
    // Navigate to existing project
    await page.click('text=E2E Test Project');
    
    // Should show step list
    await expect(page.locator('[data-testid="step-list"]')).toBeVisible();
    
    // Click on a step to expand
    await page.click('[data-testid="step-1"]');
    await expect(page.locator('[data-testid="step-details"]')).toBeVisible();
  });
  
  test('should run a test', async ({ page }) => {
    await page.click('text=E2E Test Project');
    await page.click('text=Run Test');
    
    // Should show progress
    await expect(page.locator('[data-testid="progress-bar"]')).toBeVisible();
    
    // Wait for completion (with timeout)
    await expect(page.locator('text=Test Complete')).toBeVisible({ timeout: 60000 });
  });
});

// e2e/recording.spec.ts
import { test, expect, chromium } from '@playwright/test';
import path from 'path';

test.describe('Recording Flow', () => {
  test('should record browser interactions', async ({ context }) => {
    // Load extension
    const extensionPath = path.join(__dirname, '../dist');
    const browserContext = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`
      ]
    });
    
    // Get extension page
    const [background] = browserContext.serviceWorkers();
    const extensionId = background.url().split('/')[2];
    
    // Open popup
    const popup = await browserContext.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup/index.html`);
    
    // Start recording
    await popup.click('text=New Recording');
    await popup.fill('[name="name"]', 'Test Recording');
    await popup.fill('[name="url"]', 'https://example.com');
    await popup.click('text=Start Recording');
    
    // Get the page being recorded
    const pages = browserContext.pages();
    const targetPage = pages.find(p => p.url().includes('example.com'));
    
    // Perform some actions
    await targetPage?.click('a:first-of-type');
    await targetPage?.waitForLoadState('networkidle');
    
    // Stop recording
    await popup.click('text=Stop Recording');
    
    // Verify steps were captured
    await expect(popup.locator('[data-testid="step-count"]')).toContainText('2');
    
    await browserContext.close();
  });
});
```

### 5.3 Visual Regression Testing

```typescript
// e2e/visual.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Visual Regression', () => {
  test('dashboard should match snapshot', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    
    // Wait for dynamic content to load
    await page.waitForSelector('[data-testid="project-grid"]');
    
    // Take screenshot and compare
    await expect(page).toHaveScreenshot('dashboard.png', {
      maxDiffPixels: 100
    });
  });
  
  test('project detail should match snapshot', async ({ page }) => {
    await page.goto('/dashboard/test-project-id');
    await page.waitForSelector('[data-testid="step-list"]');
    
    await expect(page).toHaveScreenshot('project-detail.png', {
      maxDiffPixels: 100
    });
  });
});
```

---

## 6. Component Testing

### 6.1 React Component Tests

```typescript
// src/components/StepList.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StepList } from './StepList';

const mockSteps = [
  { stepNumber: 1, label: 'Click Login button', event: 'click' },
  { stepNumber: 2, label: 'Type in Email field', event: 'input', value: 'test@example.com' },
  { stepNumber: 3, label: 'Type in Password field', event: 'input', value: '********' }
];

describe('StepList', () => {
  it('should render all steps', () => {
    render(<StepList steps={mockSteps} projectId="test-id" />);
    
    expect(screen.getByText('Click Login button')).toBeInTheDocument();
    expect(screen.getByText('Type in Email field')).toBeInTheDocument();
    expect(screen.getByText('Type in Password field')).toBeInTheDocument();
  });
  
  it('should show step numbers', () => {
    render(<StepList steps={mockSteps} projectId="test-id" />);
    
    expect(screen.getByText('1.')).toBeInTheDocument();
    expect(screen.getByText('2.')).toBeInTheDocument();
    expect(screen.getByText('3.')).toBeInTheDocument();
  });
  
  it('should expand step details on click', async () => {
    render(<StepList steps={mockSteps} projectId="test-id" />);
    
    fireEvent.click(screen.getByText('Click Login button'));
    
    await waitFor(() => {
      expect(screen.getByText('Event:')).toBeInTheDocument();
      expect(screen.getByText('click')).toBeInTheDocument();
    });
  });
  
  it('should call onDelete when delete button clicked', async () => {
    const onDelete = vi.fn();
    render(<StepList steps={mockSteps} projectId="test-id" onDelete={onDelete} />);
    
    // Find and click delete button for first step
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    fireEvent.click(deleteButtons[0]);
    
    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith(0);
    });
  });
  
  it('should show empty state when no steps', () => {
    render(<StepList steps={[]} projectId="test-id" />);
    
    expect(screen.getByText(/no steps recorded/i)).toBeInTheDocument();
  });
  
  it('should support drag and drop reordering', async () => {
    const onReorder = vi.fn();
    render(<StepList steps={mockSteps} projectId="test-id" onReorder={onReorder} />);
    
    // Simulate drag and drop
    const dragHandles = screen.getAllByTestId('drag-handle');
    
    fireEvent.dragStart(dragHandles[0]);
    fireEvent.dragOver(dragHandles[2]);
    fireEvent.drop(dragHandles[2]);
    
    await waitFor(() => {
      expect(onReorder).toHaveBeenCalled();
    });
  });
});

// src/components/ProgressBar.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressBar } from './ProgressBar';

describe('ProgressBar', () => {
  it('should show correct percentage', () => {
    render(<ProgressBar progress={75} status="running" />);
    
    expect(screen.getByText('75%')).toBeInTheDocument();
  });
  
  it('should apply running style when status is running', () => {
    render(<ProgressBar progress={50} status="running" />);
    
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveClass('bg-blue-500');
  });
  
  it('should apply success style when completed', () => {
    render(<ProgressBar progress={100} status="completed" />);
    
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveClass('bg-green-500');
  });
  
  it('should apply error style when failed', () => {
    render(<ProgressBar progress={60} status="failed" />);
    
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveClass('bg-red-500');
  });
  
  it('should be accessible', () => {
    render(<ProgressBar progress={50} status="running" />);
    
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '50');
    expect(progressBar).toHaveAttribute('aria-valuemin', '0');
    expect(progressBar).toHaveAttribute('aria-valuemax', '100');
  });
});
```

---

## 7. Extension-Specific Testing

### 7.1 Content Script Tests

```typescript
// src/content/recorder.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Recorder } from './recorder';

describe('Recorder', () => {
  let recorder: Recorder;
  let container: HTMLDivElement;
  
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    recorder = new Recorder();
  });
  
  afterEach(() => {
    recorder.stop();
    document.body.removeChild(container);
  });
  
  it('should capture click events', async () => {
    const onStep = vi.fn();
    recorder.onStep(onStep);
    recorder.start();
    
    const button = document.createElement('button');
    button.textContent = 'Click me';
    container.appendChild(button);
    
    button.click();
    
    await vi.waitFor(() => {
      expect(onStep).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'click',
          label: expect.stringContaining('Click me')
        })
      );
    });
  });
  
  it('should capture input events', async () => {
    const onStep = vi.fn();
    recorder.onStep(onStep);
    recorder.start();
    
    const input = document.createElement('input');
    input.placeholder = 'Enter name';
    container.appendChild(input);
    
    input.value = 'John';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    
    await vi.waitFor(() => {
      expect(onStep).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'input',
          value: 'John'
        })
      );
    });
  });
  
  it('should not capture events when stopped', () => {
    const onStep = vi.fn();
    recorder.onStep(onStep);
    recorder.start();
    recorder.stop();
    
    const button = document.createElement('button');
    container.appendChild(button);
    button.click();
    
    expect(onStep).not.toHaveBeenCalled();
  });
  
  it('should handle shadow DOM elements', async () => {
    const onStep = vi.fn();
    recorder.onStep(onStep);
    recorder.start();
    
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const button = document.createElement('button');
    button.textContent = 'Shadow Button';
    shadow.appendChild(button);
    container.appendChild(host);
    
    button.click();
    
    await vi.waitFor(() => {
      expect(onStep).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'click',
          label: expect.stringContaining('Shadow Button')
        })
      );
    });
  });
});
```

### 7.2 Background Service Tests

```typescript
// src/background/service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BackgroundService } from './service';

describe('BackgroundService', () => {
  let service: BackgroundService;
  
  beforeEach(() => {
    service = new BackgroundService();
  });
  
  it('should handle startRecording action', async () => {
    const tabId = 1;
    const recordingId = 'rec-123';
    
    vi.mocked(chrome.tabs.sendMessage).mockResolvedValue({ success: true });
    
    const response = await service.handleMessage({
      action: 'startRecording',
      tabId,
      recordingId
    });
    
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
      tabId,
      { action: 'startRecording', recordingId }
    );
    expect(response).toEqual({ success: true });
  });
  
  it('should handle getProject action', async () => {
    const projectId = 'proj-123';
    const mockProject = { id: projectId, name: 'Test' };
    
    vi.mocked(chrome.storage.local.get).mockResolvedValue({
      [`project_${projectId}`]: mockProject
    });
    
    const response = await service.handleMessage({
      action: 'getProject',
      projectId
    });
    
    expect(response).toEqual(mockProject);
  });
  
  it('should inject content script when needed', async () => {
    const tabId = 1;
    
    vi.mocked(chrome.scripting.executeScript).mockResolvedValue([]);
    
    await service.ensureContentScript(tabId);
    
    expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId },
      files: ['content-script.js']
    });
  });
});
```

---

## 8. Performance Testing

### 8.1 Load Testing Configuration

```javascript
// k6/load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 10 },   // Ramp up to 10 users
    { duration: '3m', target: 10 },   // Stay at 10 users
    { duration: '1m', target: 50 },   // Ramp up to 50 users
    { duration: '3m', target: 50 },   // Stay at 50 users
    { duration: '1m', target: 0 }     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests under 500ms
    http_req_failed: ['rate<0.01']     // Error rate under 1%
  }
};

export default function () {
  const baseUrl = __ENV.BASE_URL || 'https://testflow.app';
  
  // Test API endpoints
  const projectsResponse = http.get(`${baseUrl}/api/projects`, {
    headers: { 'Authorization': `Bearer ${__ENV.AUTH_TOKEN}` }
  });
  
  check(projectsResponse, {
    'projects status is 200': (r) => r.status === 200,
    'projects response time OK': (r) => r.timings.duration < 500
  });
  
  sleep(1);
}
```

### 8.2 Performance Benchmarks

```typescript
// src/test/performance/locator.bench.ts
import { describe, bench } from 'vitest';
import { generateLocatorBundle } from '../../utils/locator-generator';

describe('Locator Generation Performance', () => {
  let complexElement: HTMLElement;
  
  beforeAll(() => {
    // Create deeply nested element
    const container = document.createElement('div');
    let current = container;
    for (let i = 0; i < 10; i++) {
      const child = document.createElement('div');
      child.className = `level-${i}`;
      current.appendChild(child);
      current = child;
    }
    const button = document.createElement('button');
    button.id = 'deep-button';
    button.textContent = 'Deep Button';
    current.appendChild(button);
    document.body.appendChild(container);
    complexElement = button;
  });
  
  bench('generate locator bundle', () => {
    generateLocatorBundle(complexElement);
  });
  
  bench('generate locator bundle x100', () => {
    for (let i = 0; i < 100; i++) {
      generateLocatorBundle(complexElement);
    }
  });
});

// Expected results:
// generate locator bundle: ~0.5ms
// generate locator bundle x100: ~50ms
```

---

## 9. Test Data Management

### 9.1 Fixtures

```typescript
// src/test/fixtures/projects.ts
import { Project, RecordedStep } from '@/types';

export const mockProject: Project = {
  id: 'proj-test-123',
  userId: 'user-test-123',
  name: 'Test Project',
  description: 'A test project for unit tests',
  targetUrl: 'https://example.com',
  status: 'draft',
  recordedSteps: [],
  parsedFields: [],
  csvData: [],
  createdDate: new Date('2024-01-01'),
  updatedDate: new Date('2024-01-01')
};

export const mockSteps: RecordedStep[] = [
  {
    stepNumber: 1,
    label: 'Navigate to https://example.com',
    event: 'navigate',
    bundle: { url: 'https://example.com' }
  },
  {
    stepNumber: 2,
    label: 'Click Login button',
    event: 'click',
    selector: '#login-btn',
    bundle: {
      id: 'login-btn',
      xpath: '//*[@id="login-btn"]',
      textContent: 'Login'
    }
  },
  {
    stepNumber: 3,
    label: 'Type in Email field',
    event: 'input',
    selector: '#email',
    value: 'test@example.com',
    bundle: {
      id: 'email',
      name: 'email',
      placeholder: 'Enter your email'
    }
  }
];

export const mockCsvData = [
  { email: 'user1@example.com', password: 'pass1', name: 'User One' },
  { email: 'user2@example.com', password: 'pass2', name: 'User Two' },
  { email: 'user3@example.com', password: 'pass3', name: 'User Three' }
];

// src/test/fixtures/test-runs.ts
import { TestRun, StepResult } from '@/types';

export const mockTestRun: TestRun = {
  id: 'run-test-123',
  projectId: 'proj-test-123',
  status: 'completed',
  totalSteps: 10,
  passedSteps: 9,
  failedSteps: 1,
  skippedSteps: 0,
  totalRows: 3,
  passedRows: 2,
  failedRows: 1,
  passRate: 90,
  duration: 15000,
  createdAt: new Date('2024-01-01T10:00:00'),
  startedAt: new Date('2024-01-01T10:00:01'),
  completedAt: new Date('2024-01-01T10:00:16')
};

export const mockStepResults: StepResult[] = [
  { stepNumber: 1, rowIndex: 0, success: true, duration: 500 },
  { stepNumber: 2, rowIndex: 0, success: true, duration: 1200 },
  { stepNumber: 3, rowIndex: 0, success: false, duration: 5000, error: 'Element not found' }
];
```

### 9.2 Factory Functions

```typescript
// src/test/factories/project.factory.ts
import { Project } from '@/types';
import { mockProject } from '../fixtures/projects';

let idCounter = 0;

export function createProject(overrides: Partial<Project> = {}): Project {
  idCounter++;
  return {
    ...mockProject,
    id: `proj-${idCounter}`,
    name: `Test Project ${idCounter}`,
    createdDate: new Date(),
    updatedDate: new Date(),
    ...overrides
  };
}

export function createProjects(count: number, overrides: Partial<Project> = {}): Project[] {
  return Array.from({ length: count }, () => createProject(overrides));
}

// Usage in tests
import { createProject, createProjects } from '@/test/factories/project.factory';

it('should handle multiple projects', () => {
  const projects = createProjects(5);
  // Test with 5 unique projects
});

it('should handle specific project state', () => {
  const project = createProject({
    status: 'complete',
    recordedSteps: mockSteps
  });
  // Test with specific configuration
});
```

---

## 10. CI/CD Integration

### 10.1 GitHub Actions Test Workflow

```yaml
# .github/workflows/test.yml
name: Test

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm run test:unit -- --coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          flags: unit

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: testflow_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run integration tests
        run: npm run test:integration
        env:
          TEST_DATABASE_URL: postgres://test:test@localhost:5432/testflow_test

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright browsers
        run: npx playwright install --with-deps
      
      - name: Build application
        run: npm run build
      
      - name: Run E2E tests
        run: npm run test:e2e
        env:
          BASE_URL: http://localhost:3000
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
```

---

## 11. Coverage Requirements

### 11.1 Coverage Targets

| Component | Line | Branch | Function | Statement |
|-----------|------|--------|----------|-----------|
| Core Logic | 90% | 85% | 90% | 90% |
| UI Components | 80% | 75% | 80% | 80% |
| Utilities | 95% | 90% | 95% | 95% |
| API Routes | 85% | 80% | 85% | 85% |
| Overall | 80% | 75% | 80% | 80% |

### 11.2 Coverage Commands

```bash
# Run tests with coverage
npm run test -- --coverage

# View coverage report
open coverage/index.html

# Check coverage thresholds
npm run test -- --coverage --coverage-threshold
```

---

## 12. Testing Tools Reference

| Tool | Purpose | Documentation |
|------|---------|---------------|
| Vitest | Unit/Integration tests | vitest.dev |
| Playwright | E2E testing | playwright.dev |
| Testing Library | Component testing | testing-library.com |
| MSW | API mocking | mswjs.io |
| k6 | Load testing | k6.io |
| Faker | Test data generation | fakerjs.dev |
| Codecov | Coverage reporting | codecov.io |

---

## Summary

Testing Strategy provides:

✅ Testing pyramid with 70/20/10 distribution  
✅ Unit testing with Vitest and mocks  
✅ Integration testing for APIs and database  
✅ E2E testing with Playwright  
✅ Component testing for React UI  
✅ Extension-specific testing patterns  
✅ Performance testing with k6  
✅ Test data management with fixtures and factories  
✅ CI/CD integration with GitHub Actions  
✅ Coverage requirements and thresholds  

This ensures code quality and reliability across all system components.
