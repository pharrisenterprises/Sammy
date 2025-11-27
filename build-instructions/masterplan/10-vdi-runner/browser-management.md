# Browser Management
**Project:** Chrome Extension Test Recorder - VDI Runner  
**Document Version:** 1.0  
**Last Updated:** November 25, 2025  
**Status:** Complete Technical Specification

## Table of Contents
1. Overview
2. Browser Lifecycle
3. Context Configuration
4. Page Management
5. Tab Management
6. Stealth Configuration
7. Resource Optimization
8. Error Recovery
9. Monitoring
10. Testing Strategy

---

## 1. Overview

### 1.1 Purpose

Browser Management handles the complete lifecycle of Playwright browser instances, contexts, and pages, including configuration, resource optimization, and cleanup.

### 1.2 Key Responsibilities

- **Browser Launching**: Configure and launch Chromium with stealth settings
- **Context Management**: Create isolated browser contexts with custom settings
- **Page Lifecycle**: Create, navigate, and close pages
- **Tab Management**: Handle multi-tab scenarios with tab mapping
- **Resource Cleanup**: Properly close browsers and free resources
- **Configuration**: Apply user-specific settings (viewport, user agent, timeouts)
- **Monitoring**: Track resource usage and performance metrics

### 1.3 Design Principles
```
1. ISOLATION
   - Each job gets fresh browser context
   - No state shared between jobs
   - Clean slate for every execution

2. EFFICIENCY
   - Reuse browser instance across jobs
   - Pool contexts for concurrent execution
   - Lazy cleanup (close pages immediately, browsers delayed)

3. STEALTH
   - Hide automation indicators
   - Use realistic user agent
   - Disable bot detection features

4. RELIABILITY
   - Automatic cleanup on errors
   - Resource leak prevention
   - Graceful shutdown
```

---

## 2. Browser Lifecycle

### 2.1 Lifecycle States
```
Created → Launched → Active → Idle → Closing → Closed
```

### 2.2 Lifecycle Manager
```typescript
// src/browser-manager.ts
import { chromium, Browser, BrowserContext } from 'playwright';

export class BrowserManager {
  private browser: Browser | null = null;
  private contexts: Map<string, BrowserContext> = new Map();
  private isShuttingDown: boolean = false;

  async initialize(): Promise<void> {
    if (this.browser) {
      return; // Already initialized
    }

    console.log('🚀 Initializing browser...');

    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    console.log('✅ Browser initialized');
  }

  async createContext(jobId: string, config?: ContextConfig): Promise<BrowserContext> {
    if (!this.browser) {
      await this.initialize();
    }

    const context = await this.browser!.newContext({
      viewport: config?.viewport || { width: 1920, height: 1080 },
      userAgent: config?.userAgent || this.getDefaultUserAgent(),
      ignoreHTTPSErrors: config?.ignoreHTTPSErrors || false,
      acceptDownloads: config?.acceptDownloads || false,
      locale: config?.locale || 'en-US',
      timezoneId: config?.timezoneId || 'America/New_York',
      permissions: config?.permissions || [],
      geolocation: config?.geolocation,
      colorScheme: config?.colorScheme || 'light',
      deviceScaleFactor: config?.deviceScaleFactor || 1
    });

    // Set default timeouts
    context.setDefaultTimeout(config?.timeout || 30000);
    context.setDefaultNavigationTimeout(config?.navigationTimeout || 30000);

    // Store context
    this.contexts.set(jobId, context);

    console.log(`✅ Context created for job: ${jobId}`);

    return context;
  }

  async closeContext(jobId: string): Promise<void> {
    const context = this.contexts.get(jobId);

    if (context) {
      await context.close();
      this.contexts.delete(jobId);
      console.log(`🔒 Context closed for job: ${jobId}`);
    }
  }

  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    console.log('⏸️  Shutting down browser...');

    // Close all contexts
    for (const [jobId, context] of this.contexts.entries()) {
      await context.close();
      this.contexts.delete(jobId);
    }

    // Close browser
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }

    console.log('✅ Browser shutdown complete');
  }

  private getDefaultUserAgent(): string {
    return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  }
}
```

---

## 3. Context Configuration

### 3.1 Configuration Interface
```typescript
interface ContextConfig {
  // Viewport
  viewport?: {
    width: number;
    height: number;
  };

  // User Agent
  userAgent?: string;

  // Security
  ignoreHTTPSErrors?: boolean;
  acceptDownloads?: boolean;

  // Locale & Timezone
  locale?: string;
  timezoneId?: string;

  // Permissions
  permissions?: Array<string>;

  // Geolocation
  geolocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };

  // Display
  colorScheme?: 'light' | 'dark' | 'no-preference';
  deviceScaleFactor?: number;

  // Timeouts
  timeout?: number;              // Default: 30000ms
  navigationTimeout?: number;    // Default: 30000ms

  // Recording (Phase 2)
  recordVideo?: {
    dir: string;
    size?: { width: number; height: number };
  };

  // HAR Recording (Phase 2)
  recordHar?: {
    path: string;
    omitContent?: boolean;
  };
}
```

### 3.2 Preset Configurations
```typescript
export const CONTEXT_PRESETS = {
  desktop: {
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    deviceScaleFactor: 1
  },

  mobile: {
    viewport: { width: 375, height: 667 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    deviceScaleFactor: 2
  },

  tablet: {
    viewport: { width: 768, height: 1024 },
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    deviceScaleFactor: 2
  },

  debug: {
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    timeout: 60000,
    navigationTimeout: 60000
  }
};
```

---

## 4. Page Management

### 4.1 Page Lifecycle
```typescript
export class PageManager {
  private pages: Map<string, Page> = new Map();

  async createPage(
    context: BrowserContext,
    pageId: string
  ): Promise<Page> {
    const page = await context.newPage();

    // Store page
    this.pages.set(pageId, page);

    console.log(`📄 Page created: ${pageId}`);

    return page;
  }

  async closePage(pageId: string): Promise<void> {
    const page = this.pages.get(pageId);

    if (page) {
      await page.close();
      this.pages.delete(pageId);
      console.log(`🔒 Page closed: ${pageId}`);
    }
  }

  getPage(pageId: string): Page | undefined {
    return this.pages.get(pageId);
  }

  async closeAllPages(): Promise<void> {
    for (const [pageId, page] of this.pages.entries()) {
      await page.close();
      this.pages.delete(pageId);
    }

    console.log('🔒 All pages closed');
  }
}
```

### 4.2 Page Configuration
```typescript
async configurePage(page: Page, config: PageConfig): Promise<void> {
  // Set extra HTTP headers
  if (config.extraHeaders) {
    await page.setExtraHTTPHeaders(config.extraHeaders);
  }

  // Block resources (images, fonts, etc.)
  if (config.blockResources) {
    await page.route('**/*', (route) => {
      const resourceType = route.request().resourceType();
      
      if (config.blockResources!.includes(resourceType)) {
        route.abort();
      } else {
        route.continue();
      }
    });
  }

  // Add initialization scripts
  if (config.initScripts) {
    for (const script of config.initScripts) {
      await page.addInitScript(script);
    }
  }

  // Set viewport
  if (config.viewport) {
    await page.setViewportSize(config.viewport);
  }
}
```

---

## 5. Tab Management

### 5.1 Tab Mapping
```typescript
export class TabManager {
  private tabMap: Map<string, Page> = new Map();

  registerTab(tabId: string, page: Page): void {
    this.tabMap.set(tabId, page);
    console.log(`✅ Tab registered: ${tabId}`);
  }

  getTab(tabId: string): Page | undefined {
    return this.tabMap.get(tabId);
  }

  async closeTab(tabId: string): Promise<void> {
    const page = this.tabMap.get(tabId);

    if (page) {
      await page.close();
      this.tabMap.delete(tabId);
      console.log(`🔒 Tab closed: ${tabId}`);
    }
  }

  async closeAllTabs(): Promise<void> {
    for (const [tabId, page] of this.tabMap.entries()) {
      await page.close();
      this.tabMap.delete(tabId);
    }

    console.log('🔒 All tabs closed');
  }

  listTabs(): string[] {
    return Array.from(this.tabMap.keys());
  }
}
```

### 5.2 Multi-Tab Execution
```typescript
async executeMultiTabStep(
  step: RecordedStep,
  tabManager: TabManager
): Promise<void> {
  // Get target tab
  const targetTab = tabManager.getTab(step.tabId || 'main');

  if (!targetTab) {
    throw new Error(`Tab not found: ${step.tabId}`);
  }

  // Handle new tab creation
  if (step.navigation?.type === 'new_tab') {
    const newPage = await targetTab.context().newPage();
    const newTabId = `tab-${Date.now()}`;
    
    tabManager.registerTab(newTabId, newPage);
    
    console.log(`📄 New tab created: ${newTabId}`);
  }

  // Execute step on target tab
  await this.executeStep(targetTab, step);
}
```

---

## 6. Stealth Configuration

### 6.1 Anti-Detection Techniques
```typescript
async applyStealth(context: BrowserContext): Promise<void> {
  // Override navigator.webdriver
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined
    });
  });

  // Override chrome object
  await context.addInitScript(() => {
    (window as any).chrome = {
      runtime: {}
    };
  });

  // Override plugins
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5]
    });
  });

  // Override languages
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en']
    });
  });

  // Remove automation-specific properties
  await context.addInitScript(() => {
    delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Array;
    delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Promise;
    delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
  });
}
```

### 6.2 Playwright Stealth Plugin (Phase 2)
```typescript
import { PlaywrightStealthPlugin } from 'playwright-extra-plugin-stealth';

async createStealthContext(): Promise<BrowserContext> {
  const browser = await chromium.launch();
  
  // Apply stealth plugin
  const context = await browser.newContext();
  await PlaywrightStealthPlugin.applyTo(context);
  
  return context;
}
```

---

## 7. Resource Optimization

### 7.1 Resource Blocking
```typescript
async optimizeResourceLoading(page: Page): Promise<void> {
  await page.route('**/*', (route) => {
    const request = route.request();
    const resourceType = request.resourceType();

    // Block unnecessary resources
    const blockedTypes = ['image', 'font', 'media'];

    if (blockedTypes.includes(resourceType)) {
      route.abort();
    } else {
      route.continue();
    }
  });

  console.log('✅ Resource blocking enabled');
}
```

### 7.2 Memory Management
```typescript
export class ResourceMonitor {
  async getMemoryUsage(page: Page): Promise<MemoryMetrics> {
    const metrics = await page.evaluate(() => {
      if (performance.memory) {
        return {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
        };
      }
      return null;
    });

    return metrics || {
      usedJSHeapSize: 0,
      totalJSHeapSize: 0,
      jsHeapSizeLimit: 0
    };
  }

  async clearBrowserCache(context: BrowserContext): Promise<void> {
    await context.clearCookies();
    await context.clearPermissions();
    
    console.log('🗑️  Browser cache cleared');
  }
}
```

---

## 8. Error Recovery

### 8.1 Browser Crash Recovery
```typescript
async handleBrowserCrash(error: Error): Promise<void> {
  console.error('💥 Browser crashed:', error);

  // Close crashed browser
  if (this.browser) {
    try {
      await this.browser.close();
    } catch (err) {
      // Ignore close errors
    }
    this.browser = null;
  }

  // Clear all contexts
  this.contexts.clear();

  // Reinitialize
  await this.initialize();

  console.log('✅ Browser recovered from crash');
}
```

### 8.2 Timeout Handling
```typescript
async executeWithTimeout<T>(
  fn: () => Promise<T>,
  timeout: number
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Operation timeout')), timeout)
    )
  ]);
}
```

---

## 9. Monitoring

### 9.1 Browser Metrics
```typescript
interface BrowserMetrics {
  browserPID: number;
  contexts: number;
  pages: number;
  memoryUsage: number;
  uptime: number;
}

async getBrowserMetrics(): Promise<BrowserMetrics> {
  if (!this.browser) {
    throw new Error('Browser not initialized');
  }

  const process = await this.browser.browserType().executablePath();

  return {
    browserPID: this.browser.process()?.pid || 0,
    contexts: this.contexts.size,
    pages: Array.from(this.contexts.values()).reduce(
      (sum, ctx) => sum + ctx.pages().length,
      0
    ),
    memoryUsage: process.memoryUsage?.rss || 0,
    uptime: Date.now() - this.startTime
  };
}
```

---

## 10. Testing Strategy

### 10.1 Unit Tests
```typescript
describe('BrowserManager', () => {
  it('initializes browser', async () => {
    const manager = new BrowserManager();
    await manager.initialize();

    expect(manager.browser).toBeDefined();

    await manager.shutdown();
  });

  it('creates isolated contexts', async () => {
    const manager = new BrowserManager();
    await manager.initialize();

    const ctx1 = await manager.createContext('job-1');
    const ctx2 = await manager.createContext('job-2');

    expect(ctx1).not.toBe(ctx2);

    await manager.shutdown();
  });
});
```

### 10.2 Integration Tests
```typescript
describe('Browser Lifecycle', () => {
  it('handles multiple jobs sequentially', async () => {
    const manager = new BrowserManager();
    await manager.initialize();

    // Job 1
    const ctx1 = await manager.createContext('job-1');
    const page1 = await ctx1.newPage();
    await page1.goto('https://example.com');
    await manager.closeContext('job-1');

    // Job 2
    const ctx2 = await manager.createContext('job-2');
    const page2 = await ctx2.newPage();
    await page2.goto('https://example.com');
    await manager.closeContext('job-2');

    await manager.shutdown();

    expect(manager.contexts.size).toBe(0);
  });
});
```

---

## Summary

Browser Management provides:
- ✅ **Browser lifecycle management** with initialization and shutdown
- ✅ **Context isolation** for concurrent job execution
- ✅ **Page management** with creation, navigation, and cleanup
- ✅ **Tab management** for multi-tab scenarios
- ✅ **Stealth configuration** to hide automation indicators
- ✅ **Resource optimization** with blocking and memory management
- ✅ **Error recovery** for crashes and timeouts
- ✅ **Monitoring** with browser metrics
- ✅ **Testing strategy** with unit and integration tests

This provides complete browser control with Playwright.
