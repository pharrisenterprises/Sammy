/**
 * Tests for BackgroundTabManager
 * @module core/background/BackgroundTabManager.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  BackgroundTabManager,
  MockBackgroundTabManager,
  createBackgroundTabManager,
  createMockBackgroundTabManager,
  getBackgroundTabManager,
  resetBackgroundTabManager,
  DEFAULT_TAB_MANAGER_CONFIG,
} from './BackgroundTabManager';

// ============================================================================
// MOCK TAB MANAGER TESTS
// ============================================================================

describe('MockBackgroundTabManager', () => {
  let manager: MockBackgroundTabManager;
  
  beforeEach(() => {
    manager = createMockBackgroundTabManager();
  });
  
  afterEach(() => {
    manager.reset();
  });
  
  // ==========================================================================
  // OPEN TAB TESTS
  // ==========================================================================
  
  describe('openTab', () => {
    it('should open tab successfully', async () => {
      const result = await manager.openTab('https://example.com');
      
      expect(result.success).toBe(true);
      expect(result.tabId).toBeDefined();
      expect(result.tabId).toBeGreaterThan(0);
    });
    
    it('should track opened tab', async () => {
      const result = await manager.openTab('https://example.com');
      
      expect(manager.isTracked(result.tabId!)).toBe(true);
    });
    
    it('should set openedTabId', async () => {
      const result = await manager.openTab('https://example.com');
      
      expect(manager.getOpenedTabId()).toBe(result.tabId);
    });
    
    it('should store URL in tracked tab', async () => {
      const result = await manager.openTab('https://example.com');
      const tab = manager.getTrackedTab(result.tabId!);
      
      expect(tab?.url).toBe('https://example.com');
    });
    
    it('should associate project ID', async () => {
      const result = await manager.openTab('https://example.com', 42);
      const tab = manager.getTrackedTab(result.tabId!);
      
      expect(tab?.projectId).toBe(42);
    });
    
    it('should fail when configured', async () => {
      manager.openShouldFail = true;
      
      const result = await manager.openTab('https://example.com');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
    
    it('should assign unique tab IDs', async () => {
      const r1 = await manager.openTab('https://example.com');
      const r2 = await manager.openTab('https://example.org');
      
      expect(r1.tabId).not.toBe(r2.tabId);
    });
  });
  
  // ==========================================================================
  // CLOSE TAB TESTS
  // ==========================================================================
  
  describe('closeTab', () => {
    it('should close existing tab', async () => {
      const result = await manager.openTab('https://example.com');
      
      const closed = await manager.closeTab(result.tabId!);
      
      expect(closed).toBe(true);
      expect(manager.isTracked(result.tabId!)).toBe(false);
    });
    
    it('should return false for non-existent tab', async () => {
      const closed = await manager.closeTab(99999);
      
      expect(closed).toBe(false);
    });
    
    it('should clear openedTabId when closing opened tab', async () => {
      const result = await manager.openTab('https://example.com');
      
      await manager.closeTab(result.tabId!);
      
      expect(manager.getOpenedTabId()).toBeNull();
    });
    
    it('should fail when configured', async () => {
      const result = await manager.openTab('https://example.com');
      manager.closeShouldFail = true;
      
      const closed = await manager.closeTab(result.tabId!);
      
      expect(closed).toBe(false);
    });
  });
  
  // ==========================================================================
  // CLOSE OPENED TAB TESTS
  // ==========================================================================
  
  describe('closeOpenedTab', () => {
    it('should close last opened tab', async () => {
      const result = await manager.openTab('https://example.com');
      
      const closed = await manager.closeOpenedTab();
      
      expect(closed).toBe(true);
      expect(manager.isTracked(result.tabId!)).toBe(false);
    });
    
    it('should return false when no tab opened', async () => {
      const closed = await manager.closeOpenedTab();
      
      expect(closed).toBe(false);
    });
  });
  
  // ==========================================================================
  // INJECT SCRIPT TESTS
  // ==========================================================================
  
  describe('injectScript', () => {
    it('should inject successfully', async () => {
      const result = await manager.openTab('https://example.com');
      
      const injected = await manager.injectScript(result.tabId!);
      
      expect(injected).toBe(true);
    });
    
    it('should update scriptInjected flag', async () => {
      const result = await manager.openTab('https://example.com');
      manager.injectShouldFail = true; // Reset injection status
      
      const tab = manager.getTrackedTab(result.tabId!);
      tab!.scriptInjected = false;
      
      manager.injectShouldFail = false;
      await manager.injectScript(result.tabId!);
      
      expect(tab?.scriptInjected).toBe(true);
    });
    
    it('should fail when configured', async () => {
      const result = await manager.openTab('https://example.com');
      manager.injectShouldFail = true;
      
      const injected = await manager.injectScript(result.tabId!);
      
      expect(injected).toBe(false);
    });
  });
  
  // ==========================================================================
  // TAB TRACKING TESTS
  // ==========================================================================
  
  describe('tab tracking', () => {
    it('should track new tab', () => {
      manager.trackTab(123, 42);
      
      expect(manager.isTracked(123)).toBe(true);
      
      const tab = manager.getTrackedTab(123);
      expect(tab?.projectId).toBe(42);
    });
    
    it('should update existing tab', () => {
      manager.trackTab(123, 1);
      manager.trackTab(123, 2);
      
      const tab = manager.getTrackedTab(123);
      expect(tab?.projectId).toBe(2);
    });
    
    it('should untrack tab', () => {
      manager.trackTab(123);
      manager.untrackTab(123);
      
      expect(manager.isTracked(123)).toBe(false);
    });
    
    it('should return null for untracked tab', () => {
      const tab = manager.getTrackedTab(99999);
      
      expect(tab).toBeNull();
    });
    
    it('should return all tracked tabs', async () => {
      await manager.openTab('https://example1.com');
      await manager.openTab('https://example2.com');
      await manager.openTab('https://example3.com');
      
      const tabs = manager.getTrackedTabs();
      
      expect(tabs).toHaveLength(3);
    });
  });
  
  // ==========================================================================
  // SEND MESSAGE TESTS
  // ==========================================================================
  
  describe('sendToTab', () => {
    it('should send message successfully', async () => {
      const result = await manager.openTab('https://example.com');
      
      const response = await manager.sendToTab(result.tabId!, { type: 'test' });
      
      expect(response).toBe(true);
    });
    
    it('should use custom message handler', async () => {
      manager.setMessageHandler((tabId, message) => {
        return { received: message, tabId };
      });
      
      const result = await manager.openTab('https://example.com');
      const response = await manager.sendToTab<{ received: unknown; tabId: number }>(
        result.tabId!,
        { type: 'test' }
      );
      
      expect(response.received).toEqual({ type: 'test' });
      expect(response.tabId).toBe(result.tabId);
    });
    
    it('should fail when configured', async () => {
      const result = await manager.openTab('https://example.com');
      manager.sendShouldFail = true;
      
      await expect(
        manager.sendToTab(result.tabId!, { type: 'test' })
      ).rejects.toThrow();
    });
  });
  
  // ==========================================================================
  // PROJECT TAB TESTS
  // ==========================================================================
  
  describe('project tabs', () => {
    it('should get tabs for project', async () => {
      await manager.openTab('https://example1.com', 42);
      await manager.openTab('https://example2.com', 42);
      await manager.openTab('https://example3.com', 99);
      
      const tabs = manager.getTabsForProject(42);
      
      expect(tabs).toHaveLength(2);
      expect(tabs.every(t => t.projectId === 42)).toBe(true);
    });
    
    it('should close all project tabs', async () => {
      await manager.openTab('https://example1.com', 42);
      await manager.openTab('https://example2.com', 42);
      await manager.openTab('https://example3.com', 99);
      
      const closed = await manager.closeProjectTabs(42);
      
      expect(closed).toBe(2);
      expect(manager.getTabsForProject(42)).toHaveLength(0);
      expect(manager.getTabsForProject(99)).toHaveLength(1);
    });
  });
  
  // ==========================================================================
  // RESET TESTS
  // ==========================================================================
  
  describe('reset', () => {
    it('should clear all state', async () => {
      await manager.openTab('https://example.com');
      manager.openShouldFail = true;
      manager.injectShouldFail = true;
      
      manager.reset();
      
      expect(manager.getTrackedTabs()).toHaveLength(0);
      expect(manager.getOpenedTabId()).toBeNull();
      expect(manager.openShouldFail).toBe(false);
      expect(manager.injectShouldFail).toBe(false);
    });
  });
  
  // ==========================================================================
  // CLEAR TRACKED TABS TESTS
  // ==========================================================================
  
  describe('clearTrackedTabs', () => {
    it('should clear all tracked tabs', async () => {
      await manager.openTab('https://example1.com');
      await manager.openTab('https://example2.com');
      
      manager.clearTrackedTabs();
      
      expect(manager.getTrackedTabs()).toHaveLength(0);
      expect(manager.getOpenedTabId()).toBeNull();
    });
  });
});

// ============================================================================
// BACKGROUND TAB MANAGER TESTS (without Chrome APIs)
// ============================================================================

describe('BackgroundTabManager', () => {
  describe('configuration', () => {
    it('should use default config', () => {
      const manager = createBackgroundTabManager();
      const config = manager.getConfig();
      
      expect(config.defaultScript).toBe(DEFAULT_TAB_MANAGER_CONFIG.defaultScript);
      expect(config.allFrames).toBe(DEFAULT_TAB_MANAGER_CONFIG.allFrames);
    });
    
    it('should accept custom config', () => {
      const manager = createBackgroundTabManager({
        defaultScript: 'custom.js',
        allFrames: false,
      });
      const config = manager.getConfig();
      
      expect(config.defaultScript).toBe('custom.js');
      expect(config.allFrames).toBe(false);
    });
    
    it('should update config', () => {
      const manager = createBackgroundTabManager();
      
      manager.setConfig({ timeout: 5000 });
      
      expect(manager.getConfig().timeout).toBe(5000);
    });
  });
  
  describe('without Chrome APIs', () => {
    it('should fail to open tab', async () => {
      const manager = createBackgroundTabManager();
      
      const result = await manager.openTab('https://example.com');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not available');
    });
  });
  
  describe('tab tracking', () => {
    it('should track and untrack tabs', () => {
      const manager = createBackgroundTabManager();
      
      manager.trackTab(123, 42);
      expect(manager.isTracked(123)).toBe(true);
      
      manager.untrackTab(123);
      expect(manager.isTracked(123)).toBe(false);
    });
  });
});

// ============================================================================
// FACTORY TESTS
// ============================================================================

describe('factory functions', () => {
  afterEach(() => {
    resetBackgroundTabManager();
  });
  
  describe('createBackgroundTabManager', () => {
    it('should create manager with defaults', () => {
      const manager = createBackgroundTabManager();
      
      expect(manager).toBeInstanceOf(BackgroundTabManager);
    });
  });
  
  describe('createMockBackgroundTabManager', () => {
    it('should create mock manager', () => {
      const manager = createMockBackgroundTabManager();
      
      expect(manager).toBeInstanceOf(MockBackgroundTabManager);
    });
  });
});

// ============================================================================
// SINGLETON TESTS
// ============================================================================

describe('singleton', () => {
  afterEach(() => {
    resetBackgroundTabManager();
  });
  
  describe('getBackgroundTabManager', () => {
    it('should return same instance', () => {
      const manager1 = getBackgroundTabManager();
      const manager2 = getBackgroundTabManager();
      
      expect(manager1).toBe(manager2);
    });
  });
  
  describe('resetBackgroundTabManager', () => {
    it('should create new instance after reset', () => {
      const manager1 = getBackgroundTabManager();
      resetBackgroundTabManager();
      const manager2 = getBackgroundTabManager();
      
      expect(manager1).not.toBe(manager2);
    });
  });
});

// ============================================================================
// DEFAULT CONFIG TESTS
// ============================================================================

describe('DEFAULT_TAB_MANAGER_CONFIG', () => {
  it('should have correct default script', () => {
    expect(DEFAULT_TAB_MANAGER_CONFIG.defaultScript).toBe('js/main.js');
  });
  
  it('should inject into all frames by default', () => {
    expect(DEFAULT_TAB_MANAGER_CONFIG.allFrames).toBe(true);
  });
  
  it('should re-inject on navigation by default', () => {
    expect(DEFAULT_TAB_MANAGER_CONFIG.reinjectOnNavigation).toBe(true);
  });
  
  it('should have 30s timeout', () => {
    expect(DEFAULT_TAB_MANAGER_CONFIG.timeout).toBe(30000);
  });
  
  it('should have 100ms injection delay', () => {
    expect(DEFAULT_TAB_MANAGER_CONFIG.injectionDelay).toBe(100);
  });
});
