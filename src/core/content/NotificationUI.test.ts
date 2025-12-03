/**
 * Tests for NotificationUI
 * @module core/content/NotificationUI.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  NotificationUI,
  createNotificationUI,
  createPositionedNotificationUI,
  createSimpleNotificationUI,
  getNotificationUI,
  resetNotificationUI,
  MockNotificationUI,
  createMockNotificationUI,
  DEFAULT_UI_CONFIG,
  NOTIFICATION_COLORS,
  NOTIFICATION_ICONS,
} from './NotificationUI';
import { DEFAULT_NOTIFICATION_DURATION } from './IContentScript';
import type { NotificationConfig } from './IContentScript';

// ============================================================================
// MOCK DOM SETUP
// ============================================================================

let mockElements: HTMLElement[] = [];
let mockStyleElements: HTMLStyleElement[] = [];

const createMockElement = (tagName: string): HTMLElement => {
  const el = {
    tagName: tagName.toUpperCase(),
    id: '',
    className: '',
    textContent: '',
    style: {} as CSSStyleDeclaration,
    classList: {
      _classes: new Set<string>(),
      add(cls: string) { this._classes.add(cls); },
      remove(cls: string) { this._classes.delete(cls); },
      contains(cls: string) { return this._classes.has(cls); },
    },
    children: [] as HTMLElement[],
    appendChild: vi.fn((child: HTMLElement) => {
      (el as any).children.push(child);
      return child;
    }),
    remove: vi.fn(),
    querySelector: vi.fn((selector: string) => {
      // Simple selector matching
      for (const child of (el as any).children) {
        if (child.className && child.className.includes(selector.replace('.', ''))) {
          return child;
        }
        const found = child.querySelector?.(selector);
        if (found) return found;
      }
      return null;
    }),
    attachShadow: vi.fn(() => ({
      appendChild: vi.fn(),
      querySelector: vi.fn(() => createMockElement('div')),
    })),
    onclick: null as (() => void) | null,
  } as unknown as HTMLElement;
  
  mockElements.push(el);
  return el;
};

beforeEach(() => {
  mockElements = [];
  mockStyleElements = [];
  
  vi.stubGlobal('document', {
    createElement: vi.fn((tagName: string) => createMockElement(tagName)),
    getElementById: vi.fn((id: string) => mockStyleElements.find(s => s.id === id) || null),
    body: {
      appendChild: vi.fn((el: HTMLElement) => {
        mockElements.push(el);
        return el;
      }),
    },
    head: {
      appendChild: vi.fn((el: HTMLStyleElement) => {
        mockStyleElements.push(el);
        return el;
      }),
    },
  });
  
  vi.stubGlobal('requestAnimationFrame', vi.fn((cb: () => void) => {
    cb();
    return 0;
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetNotificationUI();
});

// ============================================================================
// CONSTANTS TESTS
// ============================================================================

describe('Constants', () => {
  describe('DEFAULT_UI_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_UI_CONFIG.containerId).toBe('anthropic-auto-allow-notification');
      expect(DEFAULT_UI_CONFIG.position).toBe('top-right');
      expect(DEFAULT_UI_CONFIG.zIndex).toBe(2147483647);
      expect(DEFAULT_UI_CONFIG.useShadowDOM).toBe(true);
      expect(DEFAULT_UI_CONFIG.animationDuration).toBe(300);
    });
  });
  
  describe('NOTIFICATION_COLORS', () => {
    it('should have colors for all types', () => {
      expect(NOTIFICATION_COLORS.loading).toBeDefined();
      expect(NOTIFICATION_COLORS.success).toBeDefined();
      expect(NOTIFICATION_COLORS.error).toBeDefined();
      expect(NOTIFICATION_COLORS.info).toBeDefined();
    });
    
    it('should have bg, border, and text for each type', () => {
      for (const type of ['loading', 'success', 'error', 'info'] as const) {
        expect(NOTIFICATION_COLORS[type].bg).toBeDefined();
        expect(NOTIFICATION_COLORS[type].border).toBeDefined();
        expect(NOTIFICATION_COLORS[type].text).toBeDefined();
      }
    });
  });
  
  describe('NOTIFICATION_ICONS', () => {
    it('should have icons for all types', () => {
      expect(NOTIFICATION_ICONS.loading).toBe('⏳');
      expect(NOTIFICATION_ICONS.success).toBe('✓');
      expect(NOTIFICATION_ICONS.error).toBe('✗');
      expect(NOTIFICATION_ICONS.info).toBe('ℹ');
    });
  });
});

// ============================================================================
// MOCK NOTIFICATION UI TESTS
// ============================================================================

describe('MockNotificationUI', () => {
  let mockUI: MockNotificationUI;
  
  beforeEach(() => {
    mockUI = createMockNotificationUI();
  });
  
  describe('show', () => {
    it('should show notification', () => {
      mockUI.show({
        type: 'success',
        message: 'Test message',
      });
      
      expect(mockUI.isVisible()).toBe(true);
      expect(mockUI.getCurrentConfig()?.message).toBe('Test message');
    });
    
    it('should track show history', () => {
      mockUI.show({ type: 'info', message: 'First' });
      mockUI.show({ type: 'success', message: 'Second' });
      
      const history = mockUI.getShowHistory();
      
      expect(history).toHaveLength(2);
      expect(history[0].message).toBe('First');
      expect(history[1].message).toBe('Second');
    });
  });
  
  describe('hide', () => {
    it('should hide notification', () => {
      mockUI.show({ type: 'success', message: 'Test' });
      mockUI.hide();
      
      expect(mockUI.isVisible()).toBe(false);
      expect(mockUI.getCurrentConfig()).toBeNull();
    });
  });
  
  describe('update', () => {
    it('should update current notification', () => {
      mockUI.show({ type: 'loading', message: 'Loading...', progress: 0 });
      mockUI.update({ progress: 50 });
      
      expect(mockUI.getCurrentConfig()?.progress).toBe(50);
    });
    
    it('should not update when no notification shown', () => {
      mockUI.update({ message: 'Test' });
      
      expect(mockUI.getCurrentConfig()).toBeNull();
    });
  });
  
  describe('showLoading', () => {
    it('should show loading notification', () => {
      mockUI.showLoading('Please wait...', 30);
      
      expect(mockUI.isVisible()).toBe(true);
      expect(mockUI.getCurrentConfig()?.type).toBe('loading');
      expect(mockUI.getCurrentConfig()?.message).toBe('Please wait...');
      expect(mockUI.getCurrentConfig()?.progress).toBe(30);
      expect(mockUI.getCurrentConfig()?.showProgress).toBe(true);
    });
    
    it('should not show progress when not provided', () => {
      mockUI.showLoading('Loading...');
      
      expect(mockUI.getCurrentConfig()?.showProgress).toBe(false);
    });
  });
  
  describe('showSuccess', () => {
    it('should show success notification', () => {
      mockUI.showSuccess('Done!');
      
      expect(mockUI.getCurrentConfig()?.type).toBe('success');
      expect(mockUI.getCurrentConfig()?.message).toBe('Done!');
    });
    
    it('should use default duration', () => {
      mockUI.showSuccess('Done!');
      
      expect(mockUI.getCurrentConfig()?.duration).toBe(DEFAULT_NOTIFICATION_DURATION);
    });
    
    it('should accept custom duration', () => {
      mockUI.showSuccess('Done!', 5000);
      
      expect(mockUI.getCurrentConfig()?.duration).toBe(5000);
    });
  });
  
  describe('showError', () => {
    it('should show error notification', () => {
      mockUI.showError('Failed!');
      
      expect(mockUI.getCurrentConfig()?.type).toBe('error');
      expect(mockUI.getCurrentConfig()?.message).toBe('Failed!');
    });
    
    it('should use longer duration for errors', () => {
      mockUI.showError('Failed!');
      
      expect(mockUI.getCurrentConfig()?.duration).toBe(DEFAULT_NOTIFICATION_DURATION * 2);
    });
  });
  
  describe('getLastShown', () => {
    it('should return last shown notification', () => {
      mockUI.show({ type: 'info', message: 'First' });
      mockUI.show({ type: 'success', message: 'Second' });
      
      expect(mockUI.getLastShown()?.message).toBe('Second');
    });
    
    it('should return null when no notifications shown', () => {
      expect(mockUI.getLastShown()).toBeNull();
    });
  });
  
  describe('reset', () => {
    it('should reset all state', () => {
      mockUI.show({ type: 'success', message: 'Test' });
      mockUI.reset();
      
      expect(mockUI.isVisible()).toBe(false);
      expect(mockUI.getCurrentConfig()).toBeNull();
      expect(mockUI.getShowHistory()).toHaveLength(0);
    });
  });
});

// ============================================================================
// NOTIFICATION UI TESTS
// ============================================================================

describe('NotificationUI', () => {
  describe('configuration', () => {
    it('should use default config', () => {
      const ui = createNotificationUI();
      const config = ui.getConfig();
      
      expect(config.position).toBe(DEFAULT_UI_CONFIG.position);
      expect(config.useShadowDOM).toBe(DEFAULT_UI_CONFIG.useShadowDOM);
    });
    
    it('should accept custom config', () => {
      const ui = createNotificationUI({
        position: 'top-left',
        useShadowDOM: false,
      });
      
      const config = ui.getConfig();
      
      expect(config.position).toBe('top-left');
      expect(config.useShadowDOM).toBe(false);
    });
    
    it('should update config', () => {
      const ui = createNotificationUI();
      ui.setConfig({ position: 'bottom-right' });
      
      expect(ui.getConfig().position).toBe('bottom-right');
    });
  });
  
  describe('show', () => {
    it('should show notification', () => {
      const ui = createNotificationUI();
      
      ui.show({
        type: 'success',
        message: 'Test',
      });
      
      // Creates container and notification elements
      expect(document.createElement).toHaveBeenCalled();
    });
    
    it('should store current config', () => {
      const ui = createNotificationUI();
      
      ui.show({
        type: 'info',
        message: 'Information',
        duration: 5000,
      });
      
      const config = ui.getCurrentConfig();
      
      expect(config?.type).toBe('info');
      expect(config?.message).toBe('Information');
      expect(config?.duration).toBe(5000);
    });
  });
  
  describe('hide', () => {
    it('should clear current config', () => {
      vi.useFakeTimers();
      const ui = createNotificationUI();
      
      ui.show({ type: 'success', message: 'Test' });
      ui.hide();
      
      // After animation timeout
      vi.advanceTimersByTime(DEFAULT_UI_CONFIG.animationDuration + 100);
      
      expect(ui.getCurrentConfig()).toBeNull();
      vi.useRealTimers();
    });
  });
  
  describe('convenience methods', () => {
    it('should show loading with progress', () => {
      const ui = createNotificationUI();
      
      ui.showLoading('Loading...', 50);
      
      const config = ui.getCurrentConfig();
      
      expect(config?.type).toBe('loading');
      expect(config?.showProgress).toBe(true);
      expect(config?.progress).toBe(50);
      expect(config?.duration).toBe(0); // No auto-dismiss
    });
    
    it('should show success', () => {
      const ui = createNotificationUI();
      
      ui.showSuccess('Done!');
      
      expect(ui.getCurrentConfig()?.type).toBe('success');
    });
    
    it('should show error', () => {
      const ui = createNotificationUI();
      
      ui.showError('Failed!');
      
      expect(ui.getCurrentConfig()?.type).toBe('error');
    });
    
    it('should show info', () => {
      const ui = createNotificationUI();
      
      ui.showInfo('Note');
      
      expect(ui.getCurrentConfig()?.type).toBe('info');
    });
  });
  
  describe('destroy', () => {
    it('should clean up', () => {
      const ui = createNotificationUI();
      
      ui.show({ type: 'success', message: 'Test' });
      ui.destroy();
      
      expect(ui.getCurrentConfig()).toBeNull();
    });
  });
});

// ============================================================================
// FACTORY TESTS
// ============================================================================

describe('Factory Functions', () => {
  describe('createNotificationUI', () => {
    it('should create UI with defaults', () => {
      const ui = createNotificationUI();
      
      expect(ui).toBeInstanceOf(NotificationUI);
    });
  });
  
  describe('createPositionedNotificationUI', () => {
    it('should create UI with position', () => {
      const ui = createPositionedNotificationUI('bottom-left');
      
      expect(ui.getConfig().position).toBe('bottom-left');
    });
  });
  
  describe('createSimpleNotificationUI', () => {
    it('should create UI without shadow DOM', () => {
      const ui = createSimpleNotificationUI();
      
      expect(ui.getConfig().useShadowDOM).toBe(false);
    });
  });
});

// ============================================================================
// SINGLETON TESTS
// ============================================================================

describe('Singleton', () => {
  afterEach(() => {
    resetNotificationUI();
  });
  
  describe('getNotificationUI', () => {
    it('should return same instance', () => {
      const ui1 = getNotificationUI();
      const ui2 = getNotificationUI();
      
      expect(ui1).toBe(ui2);
    });
  });
  
  describe('resetNotificationUI', () => {
    it('should create new instance after reset', () => {
      const ui1 = getNotificationUI();
      resetNotificationUI();
      const ui2 = getNotificationUI();
      
      expect(ui1).not.toBe(ui2);
    });
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Integration', () => {
  it('should handle full notification lifecycle', () => {
    const ui = createMockNotificationUI();
    
    // Show loading
    ui.showLoading('Starting...', 0);
    expect(ui.isVisible()).toBe(true);
    expect(ui.getCurrentConfig()?.type).toBe('loading');
    
    // Update progress
    ui.update({ message: 'Processing...', progress: 50 });
    expect(ui.getCurrentConfig()?.progress).toBe(50);
    
    // Show success
    ui.showSuccess('Complete!');
    expect(ui.getCurrentConfig()?.type).toBe('success');
    
    // Hide
    ui.hide();
    expect(ui.isVisible()).toBe(false);
    
    // Check history
    expect(ui.getShowHistory()).toHaveLength(2);
  });
  
  it('should handle rapid notifications', () => {
    const ui = createMockNotificationUI();
    
    ui.show({ type: 'info', message: 'First' });
    ui.show({ type: 'success', message: 'Second' });
    ui.show({ type: 'error', message: 'Third' });
    
    // Last notification should be visible
    expect(ui.getCurrentConfig()?.message).toBe('Third');
    
    // All should be in history
    expect(ui.getShowHistory()).toHaveLength(3);
  });
});
