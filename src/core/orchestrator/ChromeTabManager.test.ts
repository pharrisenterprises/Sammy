/**
 * Tests for ChromeTabManager
 * @module core/orchestrator/ChromeTabManager.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ChromeTabManager,
  MockTabManager,
  createChromeTabManager,
  createFastTabManager,
  createTolerantTabManager,
  createMockTabManager,
  getTabManager,
  resetTabManager,
  DEFAULT_TAB_MANAGER_CONFIG,
} from './ChromeTabManager';

// ============================================================================
// MOCK TAB MANAGER TESTS
// ============================================================================

describe('MockTabManager', () => {
  let mockManager: MockTabManager;
  
  beforeEach(() => {
    mockManager = createMockTabManager();
  });
  
  afterEach(() => {
    mockManager.reset();
  });
  
  describe('openTab', () => {
    it('should open tab successfully', async () => {
      const result = await mockManager.openTab('https://example.com');
      
      expect(result.success).toBe(true);
      expect(result.tab).toBeDefined();
      expect(result.tab?.url).toBe('https://example.com');
      expect(result.tab?.tabId).toBeGreaterThan(0);
    });
    
    it('should assign unique tab IDs', async () => {
      const result1 = await mockManager.openTab('https://example.com');
      const result2 = await mockManager.openTab('https://example.org');
      
      expect(result1.tab?.tabId).not.toBe(result2.tab?.tabId);
    });
    
    it('should fail when configured', async () => {
      mockManager.openShouldFail = true;
      
      const result = await mockManager.openTab('https://example.com');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
    
    it('should track opened tabs', async () => {
      await mockManager.openTab('https://example.com');
      await mockManager.openTab('https://example.org');
      
      const tabs = mockManager.getTabs();
      expect(tabs).toHaveLength(2);
    });
  });
  
  describe('closeTab', () => {
    it('should close existing tab', async () => {
      const result = await mockManager.openTab('https://example.com');
      const tabId = result.tab!.tabId;
      
      const closed = await mockManager.closeTab(tabId);
      
      expect(closed).toBe(true);
      expect(mockManager.getTabs()).toHaveLength(0);
    });
    
    it('should return false for non-existent tab', async () => {
      const closed = await mockManager.closeTab(99999);
      
      expect(closed).toBe(false);
    });
  });
  
  describe('injectScript', () => {
    it('should inject successfully by default', async () => {
      const result = await mockManager.openTab('https://example.com');
      
      const injected = await mockManager.injectScript(result.tab!.tabId);
      
      expect(injected).toBe(true);
    });
    
    it('should fail when configured', async () => {
      mockManager.injectShouldFail = true;
      const result = await mockManager.openTab('https://example.com');
      
      const injected = await mockManager.injectScript(result.tab!.tabId);
      
      expect(injected).toBe(false);
    });
  });
  
  describe('isTabReady', () => {
    it('should return true by default', async () => {
      const result = await mockManager.openTab('https://example.com');
      
      const ready = await mockManager.isTabReady(result.tab!.tabId);
      
      expect(ready).toBe(true);
    });
    
    it('should return false when configured', async () => {
      mockManager.isReady = false;
      const result = await mockManager.openTab('https://example.com');
      
      const ready = await mockManager.isTabReady(result.tab!.tabId);
      
      expect(ready).toBe(false);
    });
  });
  
  describe('getTabInfo', () => {
    it('should return tab info for existing tab', async () => {
      const result = await mockManager.openTab('https://example.com');
      
      const info = await mockManager.getTabInfo(result.tab!.tabId);
      
      expect(info).not.toBeNull();
      expect(info?.url).toBe('https://example.com');
    });
    
    it('should return null for non-existent tab', async () => {
      const info = await mockManager.getTabInfo(99999);
      
      expect(info).toBeNull();
    });
  });
  
  describe('sendMessage', () => {
    it('should send message successfully', async () => {
      const result = await mockManager.openTab('https://example.com');
      
      const response = await mockManager.sendMessage(
        result.tab!.tabId,
        { type: 'test' }
      );
      
      expect(response).toBe(true);
    });
    
    it('should fail when configured', async () => {
      mockManager.sendShouldFail = true;
      const result = await mockManager.openTab('https://example.com');
      
      await expect(
        mockManager.sendMessage(result.tab!.tabId, { type: 'test' })
      ).rejects.toThrow();
    });
    
    it('should use custom message handler', async () => {
      mockManager.setMessageHandler((tabId, message) => {
        return { received: message, tabId };
      });
      
      const result = await mockManager.openTab('https://example.com');
      const response = await mockManager.sendMessage<{ received: unknown; tabId: number }>(
        result.tab!.tabId,
        { type: 'test' }
      );
      
      expect(response.received).toEqual({ type: 'test' });
      expect(response.tabId).toBe(result.tab!.tabId);
    });
  });
  
  describe('reset', () => {
    it('should clear all state', async () => {
      await mockManager.openTab('https://example.com');
      mockManager.openShouldFail = true;
      mockManager.isReady = false;
      
      mockManager.reset();
      
      expect(mockManager.getTabs()).toHaveLength(0);
      expect(mockManager.openShouldFail).toBe(false);
      expect(mockManager.isReady).toBe(true);
    });
  });
});

// ============================================================================
// CHROME TAB MANAGER TESTS (without Chrome APIs)
// ============================================================================

describe('ChromeTabManager', () => {
  describe('configuration', () => {
    it('should use default config', () => {
      const manager = createChromeTabManager();
      const config = manager.getConfig();
      
      expect(config.timeout).toBe(DEFAULT_TAB_MANAGER_CONFIG.timeout);
      expect(config.loadDelay).toBe(DEFAULT_TAB_MANAGER_CONFIG.loadDelay);
    });
    
    it('should accept custom config', () => {
      const manager = createChromeTabManager({
        timeout: 5000,
        loadDelay: 100,
      });
      const config = manager.getConfig();
      
      expect(config.timeout).toBe(5000);
      expect(config.loadDelay).toBe(100);
    });
    
    it('should update config', () => {
      const manager = createChromeTabManager();
      
      manager.setConfig({ timeout: 10000 });
      
      expect(manager.getConfig().timeout).toBe(10000);
    });
  });
  
  describe('tab tracking', () => {
    it('should start with no tracked tabs', () => {
      const manager = createChromeTabManager();
      
      expect(manager.getTrackedTabs()).toHaveLength(0);
    });
    
    it('should clear tracked tabs', () => {
      const manager = createChromeTabManager();
      manager.clearTrackedTabs();
      
      expect(manager.getTrackedTabs()).toHaveLength(0);
    });
  });
  
  describe('without Chrome APIs', () => {
    it('should fail to open tab', async () => {
      const manager = createChromeTabManager();
      
      const result = await manager.openTab('https://example.com');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Chrome');
    });
  });
});

// ============================================================================
// FACTORY FUNCTION TESTS
// ============================================================================

describe('factory functions', () => {
  describe('createChromeTabManager', () => {
    it('should create manager with defaults', () => {
      const manager = createChromeTabManager();
      
      expect(manager).toBeInstanceOf(ChromeTabManager);
      expect(manager.getConfig().timeout).toBe(30000);
    });
  });
  
  describe('createFastTabManager', () => {
    it('should create manager with fast config', () => {
      const manager = createFastTabManager();
      const config = manager.getConfig();
      
      expect(config.timeout).toBe(10000);
      expect(config.loadDelay).toBe(200);
      expect(config.maxInjectionRetries).toBe(1);
      expect(config.waitForLoad).toBe(false);
    });
  });
  
  describe('createTolerantTabManager', () => {
    it('should create manager with tolerant config', () => {
      const manager = createTolerantTabManager();
      const config = manager.getConfig();
      
      expect(config.timeout).toBe(60000);
      expect(config.loadDelay).toBe(1000);
      expect(config.maxInjectionRetries).toBe(5);
      expect(config.waitForLoad).toBe(true);
    });
  });
});

// ============================================================================
// SINGLETON TESTS
// ============================================================================

describe('singleton', () => {
  afterEach(() => {
    resetTabManager();
  });
  
  describe('getTabManager', () => {
    it('should return same instance', () => {
      const manager1 = getTabManager();
      const manager2 = getTabManager();
      
      expect(manager1).toBe(manager2);
    });
  });
  
  describe('resetTabManager', () => {
    it('should create new instance after reset', () => {
      const manager1 = getTabManager();
      resetTabManager();
      const manager2 = getTabManager();
      
      expect(manager1).not.toBe(manager2);
    });
  });
});

// ============================================================================
// DEFAULT CONFIG TESTS
// ============================================================================

describe('DEFAULT_TAB_MANAGER_CONFIG', () => {
  it('should have 30s timeout', () => {
    expect(DEFAULT_TAB_MANAGER_CONFIG.timeout).toBe(30000);
  });
  
  it('should have 500ms load delay', () => {
    expect(DEFAULT_TAB_MANAGER_CONFIG.loadDelay).toBe(500);
  });
  
  it('should have 3 injection retries', () => {
    expect(DEFAULT_TAB_MANAGER_CONFIG.maxInjectionRetries).toBe(3);
  });
  
  it('should have 500ms retry delay', () => {
    expect(DEFAULT_TAB_MANAGER_CONFIG.injectionRetryDelay).toBe(500);
  });
  
  it('should wait for load by default', () => {
    expect(DEFAULT_TAB_MANAGER_CONFIG.waitForLoad).toBe(true);
  });
});
