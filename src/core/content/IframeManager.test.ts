/**
 * Tests for IframeManager
 * @module core/content/IframeManager.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  IframeManager,
  createIframeManager,
  createDebugIframeManager,
  createManualIframeManager,
  getIframeManager,
  resetIframeManager,
  isCrossOriginIframe,
  getIframeDocument,
  createIframeInfo,
  findIframesInDocument,
  DEFAULT_IFRAME_MANAGER_CONFIG,
} from './IframeManager';
import type { IframeInfo } from './IContentScript';

// ============================================================================
// MOCK SETUP
// ============================================================================

// Track created iframes for cleanup
let createdIframes: HTMLIFrameElement[] = [];

const createTestIframe = (attrs: Record<string, string> = {}): HTMLIFrameElement => {
  const iframe = document.createElement('iframe');
  for (const [key, value] of Object.entries(attrs)) {
    iframe.setAttribute(key, value);
  }
  document.body.appendChild(iframe);
  createdIframes.push(iframe);
  return iframe;
};

beforeEach(() => {
  createdIframes = [];
});

afterEach(() => {
  // Clean up iframes
  for (const iframe of createdIframes) {
    iframe.remove();
  }
  createdIframes = [];
  resetIframeManager();
});

// ============================================================================
// HELPER FUNCTION TESTS
// ============================================================================

describe('Helper Functions', () => {
  describe('isCrossOriginIframe', () => {
    it('should return false for same-origin iframe', () => {
      const iframe = createTestIframe();
      
      // Same-origin iframes should be accessible
      expect(isCrossOriginIframe(iframe)).toBe(false);
    });
    
    it('should return true when contentDocument is null', () => {
      const iframe = createTestIframe();
      
      // Mock cross-origin by making contentDocument throw
      Object.defineProperty(iframe, 'contentDocument', {
        get: () => { throw new Error('Blocked'); },
      });
      
      expect(isCrossOriginIframe(iframe)).toBe(true);
    });
  });
  
  describe('getIframeDocument', () => {
    it('should return document for same-origin iframe', () => {
      const iframe = createTestIframe();
      
      const doc = getIframeDocument(iframe);
      
      expect(doc).toBeDefined();
    });
    
    it('should return null for cross-origin iframe', () => {
      const iframe = createTestIframe();
      
      Object.defineProperty(iframe, 'contentDocument', {
        get: () => { throw new Error('Blocked'); },
      });
      
      const doc = getIframeDocument(iframe);
      
      expect(doc).toBeNull();
    });
  });
  
  describe('createIframeInfo', () => {
    it('should create IframeInfo from iframe', () => {
      const iframe = createTestIframe({
        id: 'test-frame',
        name: 'testFrame',
        src: 'about:blank',
      });
      
      const info = createIframeInfo(iframe, 0);
      
      expect(info.index).toBe(0);
      expect(info.id).toBe('test-frame');
      expect(info.name).toBe('testFrame');
      expect(info.src).toBe('about:blank');
    });
    
    it('should handle iframe without attributes', () => {
      const iframe = createTestIframe();
      
      const info = createIframeInfo(iframe, 5);
      
      expect(info.index).toBe(5);
      expect(info.id).toBeUndefined();
      expect(info.name).toBeUndefined();
    });
  });
  
  describe('findIframesInDocument', () => {
    it('should find all iframes in document', () => {
      createTestIframe({ id: 'frame1' });
      createTestIframe({ id: 'frame2' });
      createTestIframe({ id: 'frame3' });
      
      const iframes = findIframesInDocument(document);
      
      expect(iframes.length).toBeGreaterThanOrEqual(3);
    });
    
    it('should return empty array when no iframes', () => {
      // Clean up existing iframes
      for (const iframe of createdIframes) {
        iframe.remove();
      }
      createdIframes = [];
      
      // Remove any other iframes
      const existing = document.querySelectorAll('iframe');
      existing.forEach(f => f.remove());
      
      const iframes = findIframesInDocument(document);
      
      expect(iframes).toHaveLength(0);
    });
  });
});

// ============================================================================
// IFRAME MANAGER TESTS
// ============================================================================

describe('IframeManager', () => {
  let manager: IframeManager;
  
  beforeEach(() => {
    manager = createIframeManager({ debug: false, autoAttach: false });
  });
  
  afterEach(() => {
    manager.stop();
  });
  
  describe('start/stop', () => {
    it('should start manager', () => {
      manager.start();
      
      expect(manager.isRunning()).toBe(true);
    });
    
    it('should stop manager', () => {
      manager.start();
      manager.stop();
      
      expect(manager.isRunning()).toBe(false);
    });
    
    it('should not double-start', () => {
      manager.start();
      manager.start(); // Should be no-op
      
      expect(manager.isRunning()).toBe(true);
    });
  });
  
  describe('attachToIframe', () => {
    it('should attach to same-origin iframe', () => {
      manager.start();
      const iframe = createTestIframe({ id: 'test-frame' });
      
      const result = manager.attachToIframe(iframe);
      
      expect(result).toBe(true);
      expect(manager.getAttachedIframes()).toContain(iframe);
    });
    
    it('should track iframe count', () => {
      manager.start();
      createTestIframe({ id: 'frame1' });
      createTestIframe({ id: 'frame2' });
      
      manager.attachToAllIframes();
      
      expect(manager.getTrackedCount()).toBeGreaterThanOrEqual(2);
    });
  });
  
  describe('detachFromIframe', () => {
    it('should detach from iframe', () => {
      manager.start();
      const iframe = createTestIframe({ id: 'test-frame' });
      
      manager.attachToIframe(iframe);
      expect(manager.getAttachedIframes()).toContain(iframe);
      
      manager.detachFromIframe(iframe);
      expect(manager.getAttachedIframes()).not.toContain(iframe);
    });
  });
  
  describe('getAttachedIframes', () => {
    it('should return only accessible iframes', () => {
      manager.start();
      createTestIframe({ id: 'frame1' });
      createTestIframe({ id: 'frame2' });
      
      manager.attachToAllIframes();
      
      const attached = manager.getAttachedIframes();
      
      expect(attached.length).toBeGreaterThanOrEqual(2);
      expect(attached.every(f => f instanceof HTMLIFrameElement)).toBe(true);
    });
  });
  
  describe('getIframeChain', () => {
    it('should return empty array for element in main document', () => {
      manager.start();
      
      const element = document.createElement('div');
      document.body.appendChild(element);
      
      const chain = manager.getIframeChain(element);
      
      expect(chain).toHaveLength(0);
      
      element.remove();
    });
  });
  
  describe('isCrossOrigin', () => {
    it('should detect same-origin iframe', () => {
      manager.start();
      const iframe = createTestIframe();
      manager.attachToIframe(iframe);
      
      expect(manager.isCrossOrigin(iframe)).toBe(false);
    });
  });
  
  describe('onAttach callback', () => {
    it('should call onAttach when iframe is attached', () => {
      const onAttach = vi.fn();
      const managerWithCallback = createIframeManager({ onAttach, autoAttach: false });
      
      managerWithCallback.start();
      const iframe = createTestIframe({ id: 'callback-test' });
      managerWithCallback.attachToIframe(iframe);
      
      expect(onAttach).toHaveBeenCalled();
      expect(onAttach).toHaveBeenCalledWith(iframe, expect.any(Object));
      
      managerWithCallback.stop();
    });
  });
  
  describe('onDetach callback', () => {
    it('should call onDetach when iframe is detached', () => {
      const onDetach = vi.fn();
      const managerWithCallback = createIframeManager({ onDetach, autoAttach: false });
      
      managerWithCallback.start();
      const iframe = createTestIframe({ id: 'detach-test' });
      managerWithCallback.attachToIframe(iframe);
      managerWithCallback.detachFromIframe(iframe);
      
      expect(onDetach).toHaveBeenCalledWith(iframe);
      
      managerWithCallback.stop();
    });
  });
  
  describe('configuration', () => {
    it('should use default config', () => {
      const config = manager.getConfig();
      
      expect(config.maxDepth).toBe(DEFAULT_IFRAME_MANAGER_CONFIG.maxDepth);
      expect(config.autoAttach).toBe(false); // We set this in beforeEach
    });
    
    it('should accept custom config', () => {
      const customManager = createIframeManager({
        maxDepth: 5,
        debug: true,
      });
      
      const config = customManager.getConfig();
      
      expect(config.maxDepth).toBe(5);
      expect(config.debug).toBe(true);
    });
    
    it('should update config', () => {
      manager.setConfig({ maxDepth: 20 });
      
      expect(manager.getConfig().maxDepth).toBe(20);
    });
  });
  
  describe('statistics', () => {
    it('should track accessible count', () => {
      manager.start();
      createTestIframe({ id: 'frame1' });
      createTestIframe({ id: 'frame2' });
      
      manager.attachToAllIframes();
      
      expect(manager.getAccessibleCount()).toBeGreaterThanOrEqual(2);
    });
    
    it('should track max depth', () => {
      manager.start();
      createTestIframe();
      
      manager.attachToAllIframes();
      
      expect(manager.getMaxDepth()).toBeGreaterThanOrEqual(0);
    });
  });
});

// ============================================================================
// FACTORY TESTS
// ============================================================================

describe('Factory Functions', () => {
  describe('createIframeManager', () => {
    it('should create manager', () => {
      const manager = createIframeManager();
      
      expect(manager).toBeInstanceOf(IframeManager);
    });
  });
  
  describe('createDebugIframeManager', () => {
    it('should create manager with debug enabled', () => {
      const manager = createDebugIframeManager();
      
      expect(manager.getConfig().debug).toBe(true);
    });
  });
  
  describe('createManualIframeManager', () => {
    it('should create manager without auto-attach', () => {
      const manager = createManualIframeManager();
      
      expect(manager.getConfig().autoAttach).toBe(false);
    });
  });
});

// ============================================================================
// SINGLETON TESTS
// ============================================================================

describe('Singleton', () => {
  afterEach(() => {
    resetIframeManager();
  });
  
  describe('getIframeManager', () => {
    it('should return same instance', () => {
      const manager1 = getIframeManager();
      const manager2 = getIframeManager();
      
      expect(manager1).toBe(manager2);
    });
  });
  
  describe('resetIframeManager', () => {
    it('should create new instance after reset', () => {
      const manager1 = getIframeManager();
      resetIframeManager();
      const manager2 = getIframeManager();
      
      expect(manager1).not.toBe(manager2);
    });
    
    it('should stop manager on reset', () => {
      const manager = getIframeManager();
      manager.start();
      
      expect(manager.isRunning()).toBe(true);
      
      resetIframeManager();
      
      expect(manager.isRunning()).toBe(false);
    });
  });
});

// ============================================================================
// DEFAULT CONFIG TESTS
// ============================================================================

describe('DEFAULT_IFRAME_MANAGER_CONFIG', () => {
  it('should have correct default values', () => {
    expect(DEFAULT_IFRAME_MANAGER_CONFIG.autoAttach).toBe(true);
    expect(DEFAULT_IFRAME_MANAGER_CONFIG.maxDepth).toBe(10);
    expect(DEFAULT_IFRAME_MANAGER_CONFIG.debug).toBe(false);
  });
});

// ============================================================================
// MUTATION OBSERVER TESTS
// ============================================================================

describe('MutationObserver Integration', () => {
  it('should auto-attach to dynamically added iframes', async () => {
    const onAttach = vi.fn();
    const manager = createIframeManager({ 
      autoAttach: true, 
      onAttach,
      debug: false,
    });
    
    manager.start();
    
    // Create iframe after manager starts
    const iframe = createTestIframe({ id: 'dynamic-frame' });
    
    // Wait for MutationObserver to process
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // The iframe might have been attached through auto-attach on start
    // or through the mutation observer
    expect(manager.getTrackedCount()).toBeGreaterThanOrEqual(1);
    
    manager.stop();
  });
});
