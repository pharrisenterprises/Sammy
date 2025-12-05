/**
 * Chrome API Mock
 * @module test/mocks/chrome
 * @version 1.0.0
 * 
 * Mocks Chrome Extension APIs for testing.
 */

import { vi } from 'vitest';

// ============================================================================
// TYPES
// ============================================================================

interface MessageListener {
  (
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ): boolean | void;
}

// ============================================================================
// MOCK STATE
// ============================================================================

const messageListeners: MessageListener[] = [];
const storageData: Record<string, unknown> = {};

// ============================================================================
// CHROME RUNTIME MOCK
// ============================================================================

const mockRuntime = {
  id: 'test-extension-id',
  lastError: null as chrome.runtime.LastError | null,
  
  getURL: vi.fn((path: string) => `chrome-extension://test-extension-id/${path}`),
  
  sendMessage: vi.fn((message: unknown, callback?: (response: unknown) => void) => {
    // Simulate async response
    setTimeout(() => {
      // Call all listeners and collect responses
      for (const listener of messageListeners) {
        const sendResponse = (response: unknown) => {
          callback?.(response);
        };
        listener(message, { id: 'test-extension-id' }, sendResponse);
      }
    }, 0);
    return Promise.resolve();
  }),
  
  onMessage: {
    addListener: vi.fn((callback: MessageListener) => {
      messageListeners.push(callback);
    }),
    removeListener: vi.fn((callback: MessageListener) => {
      const index = messageListeners.indexOf(callback);
      if (index > -1) {
        messageListeners.splice(index, 1);
      }
    }),
    hasListener: vi.fn((callback: MessageListener) => {
      return messageListeners.includes(callback);
    }),
  },
  
  onInstalled: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
    hasListener: vi.fn(() => false),
  },
  
  getManifest: vi.fn(() => ({
    name: 'Sammy Test Extension',
    version: '1.0.0',
    manifest_version: 3,
  })),
};

// ============================================================================
// CHROME TABS MOCK
// ============================================================================

let tabIdCounter = 1;
const tabs: Map<number, chrome.tabs.Tab> = new Map();

const mockTabs = {
  create: vi.fn((createProperties: chrome.tabs.CreateProperties) => {
    const tab: chrome.tabs.Tab = {
      id: tabIdCounter++,
      index: tabs.size,
      windowId: 1,
      highlighted: true,
      active: true,
      pinned: false,
      incognito: false,
      url: createProperties.url,
      ...createProperties,
    };
    tabs.set(tab.id!, tab);
    return Promise.resolve(tab);
  }),
  
  remove: vi.fn((tabIds: number | number[]) => {
    const ids = Array.isArray(tabIds) ? tabIds : [tabIds];
    ids.forEach((id) => tabs.delete(id));
    return Promise.resolve();
  }),
  
  get: vi.fn((tabId: number) => {
    const tab = tabs.get(tabId);
    return Promise.resolve(tab);
  }),
  
  query: vi.fn((queryInfo: chrome.tabs.QueryInfo) => {
    const results = Array.from(tabs.values()).filter((tab) => {
      if (queryInfo.active !== undefined && tab.active !== queryInfo.active) return false;
      if (queryInfo.url && tab.url !== queryInfo.url) return false;
      return true;
    });
    return Promise.resolve(results);
  }),
  
  sendMessage: vi.fn((tabId: number, message: unknown, callback?: (response: unknown) => void) => {
    // Simulate async response
    setTimeout(() => {
      callback?.({ success: true });
    }, 0);
    return Promise.resolve({ success: true });
  }),
  
  onRemoved: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
    hasListener: vi.fn(() => false),
  },
  
  onUpdated: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
    hasListener: vi.fn(() => false),
  },
};

// ============================================================================
// CHROME STORAGE MOCK
// ============================================================================

const mockStorage = {
  local: {
    get: vi.fn((keys?: string | string[] | null) => {
      if (!keys) return Promise.resolve({ ...storageData });
      
      const keyArray = typeof keys === 'string' ? [keys] : keys || [];
      const result: Record<string, unknown> = {};
      
      keyArray.forEach((key) => {
        if (key in storageData) {
          result[key] = storageData[key];
        }
      });
      
      return Promise.resolve(result);
    }),
    
    set: vi.fn((items: Record<string, unknown>) => {
      Object.assign(storageData, items);
      return Promise.resolve();
    }),
    
    remove: vi.fn((keys: string | string[]) => {
      const keyArray = typeof keys === 'string' ? [keys] : keys;
      keyArray.forEach((key) => delete storageData[key]);
      return Promise.resolve();
    }),
    
    clear: vi.fn(() => {
      Object.keys(storageData).forEach((key) => delete storageData[key]);
      return Promise.resolve();
    }),
  },
  
  sync: {
    get: vi.fn(() => Promise.resolve({})),
    set: vi.fn(() => Promise.resolve()),
    remove: vi.fn(() => Promise.resolve()),
    clear: vi.fn(() => Promise.resolve()),
  },
  
  onChanged: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
    hasListener: vi.fn(() => false),
  },
};

// ============================================================================
// CHROME SCRIPTING MOCK
// ============================================================================

const mockScripting = {
  executeScript: vi.fn((injection: chrome.scripting.ScriptInjection) => {
    return Promise.resolve([{ result: undefined }]);
  }),
  
  insertCSS: vi.fn(() => Promise.resolve()),
  
  removeCSS: vi.fn(() => Promise.resolve()),
};

// ============================================================================
// CHROME ACTION MOCK
// ============================================================================

const mockAction = {
  onClicked: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
    hasListener: vi.fn(() => false),
  },
  
  setBadgeText: vi.fn(() => Promise.resolve()),
  setBadgeBackgroundColor: vi.fn(() => Promise.resolve()),
  setIcon: vi.fn(() => Promise.resolve()),
  setTitle: vi.fn(() => Promise.resolve()),
};

// ============================================================================
// CHROME WEB NAVIGATION MOCK
// ============================================================================

const mockWebNavigation = {
  onCommitted: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
    hasListener: vi.fn(() => false),
  },
  
  onCompleted: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
    hasListener: vi.fn(() => false),
  },
  
  onBeforeNavigate: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
    hasListener: vi.fn(() => false),
  },
};

// ============================================================================
// GLOBAL CHROME MOCK
// ============================================================================

const chromeMock = {
  runtime: mockRuntime,
  tabs: mockTabs,
  storage: mockStorage,
  scripting: mockScripting,
  action: mockAction,
  webNavigation: mockWebNavigation,
};

// Apply global mock
vi.stubGlobal('chrome', chromeMock);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Clear all Chrome mock state
 */
export const clearChromeMocks = (): void => {
  messageListeners.length = 0;
  tabs.clear();
  tabIdCounter = 1;
  Object.keys(storageData).forEach((key) => delete storageData[key]);
  vi.clearAllMocks();
};

/**
 * Simulate receiving a message
 */
export const simulateMessage = (
  message: unknown,
  sender: Partial<chrome.runtime.MessageSender> = {}
): Promise<unknown> => {
  return new Promise((resolve) => {
    const fullSender: chrome.runtime.MessageSender = {
      id: 'test-extension-id',
      ...sender,
    };
    
    for (const listener of messageListeners) {
      listener(message, fullSender, resolve);
    }
  });
};

/**
 * Get stored data
 */
export const getStorageData = (): Record<string, unknown> => {
  return { ...storageData };
};

/**
 * Set stored data
 */
export const setStorageData = (data: Record<string, unknown>): void => {
  Object.assign(storageData, data);
};

export { chromeMock, mockRuntime, mockTabs, mockStorage, mockScripting };
