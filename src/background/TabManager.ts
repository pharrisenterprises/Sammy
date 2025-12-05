/**
 * TabManager - Browser Tab Management
 * @module background/TabManager
 * @version 1.0.0
 * 
 * Manages browser tabs for automation sessions.
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Tab info
 */
export interface TabInfo {
  id: number;
  url: string;
  projectId?: string;
  createdAt: number;
}

/**
 * Tab open options
 */
export interface TabOpenOptions {
  url: string;
  projectId?: string;
  active?: boolean;
}

/**
 * Tab open result
 */
export interface TabOpenResult {
  success: boolean;
  tabId?: number;
  error?: string;
}

// ============================================================================
// TAB MANAGER CLASS
// ============================================================================

/**
 * Manages browser tabs for automation
 */
export class TabManager {
  private trackedTabs: Map<number, TabInfo> = new Map();
  private lastOpenedTabId: number | null = null;

  /**
   * Open a new tab
   */
  async openTab(options: TabOpenOptions): Promise<TabOpenResult> {
    try {
      const tab = await chrome.tabs.create({
        url: options.url,
        active: options.active ?? true,
      });

      if (!tab.id) {
        return { success: false, error: 'No tab ID returned' };
      }

      const tabInfo: TabInfo = {
        id: tab.id,
        url: options.url,
        projectId: options.projectId,
        createdAt: Date.now(),
      };

      this.trackedTabs.set(tab.id, tabInfo);
      this.lastOpenedTabId = tab.id;

      return { success: true, tabId: tab.id };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open tab',
      };
    }
  }

  /**
   * Close a tab
   */
  async closeTab(tabId: number): Promise<boolean> {
    try {
      await chrome.tabs.remove(tabId);
      this.trackedTabs.delete(tabId);
      
      if (this.lastOpenedTabId === tabId) {
        this.lastOpenedTabId = null;
      }
      
      return true;
    } catch (error) {
      console.error('Failed to close tab:', error);
      return false;
    }
  }

  /**
   * Close last opened tab
   */
  async closeLastOpenedTab(): Promise<boolean> {
    if (this.lastOpenedTabId === null) {
      return false;
    }
    return this.closeTab(this.lastOpenedTabId);
  }

  /**
   * Get tab info
   */
  getTabInfo(tabId: number): TabInfo | undefined {
    return this.trackedTabs.get(tabId);
  }

  /**
   * Check if tab is tracked
   */
  isTracked(tabId: number): boolean {
    return this.trackedTabs.has(tabId);
  }

  /**
   * Get last opened tab ID
   */
  getLastOpenedTabId(): number | null {
    return this.lastOpenedTabId;
  }

  /**
   * Handle tab removed event
   */
  handleTabRemoved(tabId: number): void {
    this.trackedTabs.delete(tabId);
    
    if (this.lastOpenedTabId === tabId) {
      this.lastOpenedTabId = null;
    }
  }

  /**
   * Get all tracked tabs
   */
  getTrackedTabs(): TabInfo[] {
    return Array.from(this.trackedTabs.values());
  }

  /**
   * Get tabs for project
   */
  getTabsForProject(projectId: string): TabInfo[] {
    return Array.from(this.trackedTabs.values()).filter(
      (tab) => tab.projectId === projectId
    );
  }

  /**
   * Clear all tracked tabs
   */
  clearTrackedTabs(): void {
    this.trackedTabs.clear();
    this.lastOpenedTabId = null;
  }

  /**
   * Send message to tab
   */
  async sendToTab<T = unknown>(tabId: number, message: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }
}

export default TabManager;
