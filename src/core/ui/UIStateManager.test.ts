/**
 * Tests for UIStateManager
 * @module core/ui/UIStateManager.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  UIStateManager,
  createUIStateManager,
  createLimitedLogManager,
  createTransientManager,
  getUIStateManager,
  resetUIStateManager,
  createInitialUIState,
  selectors,
  DEFAULT_STATE_MANAGER_CONFIG,
  type UIState,
  type Toast,
} from './UIStateManager';

// ============================================================================
// SETUP
// ============================================================================

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  resetUIStateManager();
});

// ============================================================================
// INITIAL STATE TESTS
// ============================================================================

describe('createInitialUIState', () => {
  it('should create initial state', () => {
    const state = createInitialUIState();
    
    expect(state.loading.isLoading).toBe(false);
    expect(state.error.hasError).toBe(false);
    expect(state.logs).toEqual([]);
    expect(state.toasts).toEqual([]);
    expect(state.isBusy).toBe(false);
    expect(state.sidebarCollapsed).toBe(false);
    expect(state.theme).toBe('system');
  });
  
  it('should accept initial theme', () => {
    const state = createInitialUIState('dark');
    
    expect(state.theme).toBe('dark');
  });
});

// ============================================================================
// UI STATE MANAGER TESTS
// ============================================================================

describe('UIStateManager', () => {
  let manager: UIStateManager;
  
  beforeEach(() => {
    manager = createUIStateManager({ persistTheme: false });
  });
  
  afterEach(() => {
    manager.destroy();
  });
  
  // ==========================================================================
  // LOADING STATE
  // ==========================================================================
  
  describe('loading state', () => {
    it('should set loading state', () => {
      manager.setLoading(true, 'Loading...');
      
      const state = manager.getLoadingState();
      
      expect(state.isLoading).toBe(true);
      expect(state.message).toBe('Loading...');
    });
    
    it('should set loading with progress', () => {
      manager.setLoading(true, 'Processing...', 50);
      
      const state = manager.getLoadingState();
      
      expect(state.isLoading).toBe(true);
      expect(state.progress).toBe(50);
    });
    
    it('should update loading progress', () => {
      manager.setLoading(true, 'Loading...');
      manager.setLoadingProgress(75, 'Almost done...');
      
      const state = manager.getLoadingState();
      
      expect(state.progress).toBe(75);
      expect(state.message).toBe('Almost done...');
    });
    
    it('should clear loading state', () => {
      manager.setLoading(true, 'Loading...');
      manager.clearLoading();
      
      expect(manager.getLoadingState().isLoading).toBe(false);
    });
  });
  
  // ==========================================================================
  // ERROR STATE
  // ==========================================================================
  
  describe('error state', () => {
    it('should set error state', () => {
      manager.setError('Something went wrong');
      
      const state = manager.getErrorState();
      
      expect(state.hasError).toBe(true);
      expect(state.message).toBe('Something went wrong');
    });
    
    it('should set error with options', () => {
      manager.setError('Fatal error', { code: 'E001', recoverable: false });
      
      const state = manager.getErrorState();
      
      expect(state.code).toBe('E001');
      expect(state.recoverable).toBe(false);
    });
    
    it('should clear error state', () => {
      manager.setError('Error');
      manager.clearError();
      
      expect(manager.getErrorState().hasError).toBe(false);
    });
  });
  
  // ==========================================================================
  // BUSY STATE
  // ==========================================================================
  
  describe('busy state', () => {
    it('should track busy operations', () => {
      manager.startOperation('fetch-projects');
      
      expect(manager.isBusy()).toBe(true);
      expect(manager.isOperationInProgress('fetch-projects')).toBe(true);
    });
    
    it('should end operations', () => {
      manager.startOperation('fetch-projects');
      manager.endOperation('fetch-projects');
      
      expect(manager.isBusy()).toBe(false);
      expect(manager.isOperationInProgress('fetch-projects')).toBe(false);
    });
    
    it('should track multiple operations', () => {
      manager.startOperation('op1');
      manager.startOperation('op2');
      
      expect(manager.isBusy()).toBe(true);
      
      manager.endOperation('op1');
      expect(manager.isBusy()).toBe(true);
      
      manager.endOperation('op2');
      expect(manager.isBusy()).toBe(false);
    });
  });
  
  // ==========================================================================
  // LOG MANAGEMENT
  // ==========================================================================
  
  describe('log management', () => {
    it('should add log entry', () => {
      const entry = manager.addLog('info', 'Test message');
      
      expect(entry.level).toBe('info');
      expect(entry.message).toBe('Test message');
      expect(manager.getLogs()).toHaveLength(1);
    });
    
    it('should add log with data', () => {
      const entry = manager.addLog('error', 'Error occurred', { step: 3 }, 'replay');
      
      expect(entry.data).toEqual({ step: 3 });
      expect(entry.source).toBe('replay');
    });
    
    it('should have convenience methods', () => {
      manager.logInfo('Info message');
      manager.logSuccess('Success message');
      manager.logWarning('Warning message');
      manager.logError('Error message');
      manager.logDebug('Debug message');
      
      const logs = manager.getLogs();
      
      expect(logs).toHaveLength(5);
      expect(logs[0].level).toBe('info');
      expect(logs[4].level).toBe('debug');
    });
    
    it('should trim logs at limit', () => {
      const limitedManager = createLimitedLogManager(5);
      
      for (let i = 0; i < 10; i++) {
        limitedManager.addLog('info', `Log ${i}`);
      }
      
      const logs = limitedManager.getLogs();
      
      expect(logs).toHaveLength(5);
      expect(logs[0].message).toBe('Log 5'); // Oldest kept
      expect(logs[4].message).toBe('Log 9'); // Newest
      
      limitedManager.destroy();
    });
    
    it('should clear logs', () => {
      manager.logInfo('Test');
      manager.clearLogs();
      
      expect(manager.getLogs()).toHaveLength(0);
    });
    
    it('should get logs by level', () => {
      manager.logInfo('Info 1');
      manager.logError('Error 1');
      manager.logInfo('Info 2');
      
      const infoLogs = manager.getLogsByLevel('info');
      
      expect(infoLogs).toHaveLength(2);
    });
    
    it('should get logs since timestamp', () => {
      const before = Date.now();
      
      manager.logInfo('Before');
      
      vi.advanceTimersByTime(1000);
      const middle = Date.now();
      
      manager.logInfo('After 1');
      manager.logInfo('After 2');
      
      const recentLogs = manager.getLogsSince(middle);
      
      expect(recentLogs).toHaveLength(2);
    });
  });
  
  // ==========================================================================
  // TOAST MANAGEMENT
  // ==========================================================================
  
  describe('toast management', () => {
    it('should show toast', () => {
      const toast = manager.showToast('success', 'Saved!');
      
      expect(toast.type).toBe('success');
      expect(toast.message).toBe('Saved!');
      expect(manager.getToasts()).toHaveLength(1);
    });
    
    it('should show toast with options', () => {
      const toast = manager.showToast('info', 'Message', {
        title: 'Title',
        duration: 3000,
        dismissible: false,
      });
      
      expect(toast.title).toBe('Title');
      expect(toast.duration).toBe(3000);
      expect(toast.dismissible).toBe(false);
    });
    
    it('should have convenience methods', () => {
      manager.toastInfo('Info');
      manager.toastSuccess('Success');
      manager.toastWarning('Warning');
      manager.toastError('Error');
      
      const toasts = manager.getToasts();
      
      expect(toasts).toHaveLength(4);
    });
    
    it('should auto-dismiss toast', () => {
      manager.showToast('success', 'Auto dismiss', { duration: 1000 });
      
      expect(manager.getToasts()).toHaveLength(1);
      
      vi.advanceTimersByTime(1000);
      
      expect(manager.getToasts()).toHaveLength(0);
    });
    
    it('should not auto-dismiss error toasts by default', () => {
      manager.toastError('Error');
      
      vi.advanceTimersByTime(10000);
      
      expect(manager.getToasts()).toHaveLength(1);
    });
    
    it('should dismiss toast manually', () => {
      const toast = manager.showToast('info', 'Test');
      manager.dismissToast(toast.id);
      
      expect(manager.getToasts()).toHaveLength(0);
    });
    
    it('should dismiss all toasts', () => {
      manager.toastInfo('One');
      manager.toastInfo('Two');
      manager.toastInfo('Three');
      
      manager.dismissAllToasts();
      
      expect(manager.getToasts()).toHaveLength(0);
    });
    
    it('should limit max toasts', () => {
      const limitedManager = createUIStateManager({
        maxToasts: 3,
        persistTheme: false,
      });
      
      limitedManager.toastInfo('1');
      limitedManager.toastInfo('2');
      limitedManager.toastInfo('3');
      limitedManager.toastInfo('4');
      limitedManager.toastInfo('5');
      
      expect(limitedManager.getToasts()).toHaveLength(3);
      
      limitedManager.destroy();
    });
  });
  
  // ==========================================================================
  // UI PREFERENCES
  // ==========================================================================
  
  describe('UI preferences', () => {
    it('should toggle sidebar', () => {
      expect(manager.getState().sidebarCollapsed).toBe(false);
      
      manager.toggleSidebar();
      expect(manager.getState().sidebarCollapsed).toBe(true);
      
      manager.toggleSidebar();
      expect(manager.getState().sidebarCollapsed).toBe(false);
    });
    
    it('should set sidebar collapsed', () => {
      manager.setSidebarCollapsed(true);
      
      expect(manager.getState().sidebarCollapsed).toBe(true);
    });
    
    it('should set theme', () => {
      manager.setTheme('dark');
      
      expect(manager.getTheme()).toBe('dark');
    });
  });
  
  // ==========================================================================
  // SUBSCRIPTIONS
  // ==========================================================================
  
  describe('subscriptions', () => {
    it('should notify listeners on state change', () => {
      const listener = vi.fn();
      manager.subscribe(listener);
      
      manager.setLoading(true);
      
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ loading: expect.objectContaining({ isLoading: true }) }),
        expect.any(Object)
      );
    });
    
    it('should unsubscribe', () => {
      const listener = vi.fn();
      const unsubscribe = manager.subscribe(listener);
      
      unsubscribe();
      
      manager.setLoading(true);
      
      expect(listener).not.toHaveBeenCalled();
    });
    
    it('should track subscriber count', () => {
      expect(manager.getSubscriberCount()).toBe(0);
      
      const unsub1 = manager.subscribe(() => {});
      const unsub2 = manager.subscribe(() => {});
      
      expect(manager.getSubscriberCount()).toBe(2);
      
      unsub1();
      expect(manager.getSubscriberCount()).toBe(1);
    });
  });
  
  // ==========================================================================
  // RESET
  // ==========================================================================
  
  describe('reset', () => {
    it('should reset state', () => {
      manager.setLoading(true);
      manager.setError('Error');
      manager.logInfo('Log');
      manager.toastInfo('Toast');
      
      manager.reset();
      
      expect(manager.getLoadingState().isLoading).toBe(false);
      expect(manager.getErrorState().hasError).toBe(false);
      expect(manager.getLogs()).toHaveLength(0);
      expect(manager.getToasts()).toHaveLength(0);
    });
    
    it('should preserve theme on reset', () => {
      manager.setTheme('dark');
      manager.reset();
      
      expect(manager.getTheme()).toBe('dark');
    });
  });
});

// ============================================================================
// FACTORY TESTS
// ============================================================================

describe('Factory Functions', () => {
  describe('createUIStateManager', () => {
    it('should create manager with defaults', () => {
      const manager = createUIStateManager({ persistTheme: false });
      
      expect(manager).toBeInstanceOf(UIStateManager);
      
      manager.destroy();
    });
  });
  
  describe('createLimitedLogManager', () => {
    it('should create manager with custom log limit', () => {
      const manager = createLimitedLogManager(10);
      
      for (let i = 0; i < 20; i++) {
        manager.addLog('info', `Log ${i}`);
      }
      
      expect(manager.getLogs()).toHaveLength(10);
      
      manager.destroy();
    });
  });
  
  describe('createTransientManager', () => {
    it('should create manager without theme persistence', () => {
      const manager = createTransientManager();
      
      // Just verify it creates successfully
      expect(manager).toBeInstanceOf(UIStateManager);
      
      manager.destroy();
    });
  });
});

// ============================================================================
// SINGLETON TESTS
// ============================================================================

describe('Singleton', () => {
  afterEach(() => {
    resetUIStateManager();
  });
  
  describe('getUIStateManager', () => {
    it('should return same instance', () => {
      const manager1 = getUIStateManager();
      const manager2 = getUIStateManager();
      
      expect(manager1).toBe(manager2);
    });
  });
  
  describe('resetUIStateManager', () => {
    it('should create new instance after reset', () => {
      const manager1 = getUIStateManager();
      resetUIStateManager();
      const manager2 = getUIStateManager();
      
      expect(manager1).not.toBe(manager2);
    });
  });
});

// ============================================================================
// SELECTORS TESTS
// ============================================================================

describe('Selectors', () => {
  it('should select loading state', () => {
    const state = createInitialUIState();
    state.loading = { isLoading: true, message: 'Test' };
    
    expect(selectors.loading(state)).toEqual(state.loading);
    expect(selectors.isLoading(state)).toBe(true);
    expect(selectors.loadingMessage(state)).toBe('Test');
  });
  
  it('should select error state', () => {
    const state = createInitialUIState();
    state.error = { hasError: true, message: 'Error' };
    
    expect(selectors.error(state)).toEqual(state.error);
    expect(selectors.hasError(state)).toBe(true);
    expect(selectors.errorMessage(state)).toBe('Error');
  });
  
  it('should select counts', () => {
    const state = createInitialUIState();
    state.logs = [
      { id: '1', timestamp: 0, level: 'info', message: 'a' },
      { id: '2', timestamp: 0, level: 'info', message: 'b' },
    ];
    state.toasts = [
      { id: '1', type: 'info', message: 'a', duration: 0, createdAt: 0, dismissible: true },
    ];
    
    expect(selectors.logCount(state)).toBe(2);
    expect(selectors.toastCount(state)).toBe(1);
  });
});

// ============================================================================
// DEFAULT CONFIG TESTS
// ============================================================================

describe('DEFAULT_STATE_MANAGER_CONFIG', () => {
  it('should have correct default values', () => {
    expect(DEFAULT_STATE_MANAGER_CONFIG.maxLogs).toBe(500);
    expect(DEFAULT_STATE_MANAGER_CONFIG.defaultToastDuration).toBe(5000);
    expect(DEFAULT_STATE_MANAGER_CONFIG.maxToasts).toBe(5);
    expect(DEFAULT_STATE_MANAGER_CONFIG.initialTheme).toBe('system');
    expect(DEFAULT_STATE_MANAGER_CONFIG.persistTheme).toBe(true);
  });
});
