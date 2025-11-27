# Background Service - Component Breakdown

## 1. Purpose
Manifest V3 service worker providing message routing, IndexedDB coordination, tab management, content script injection, and persistent storage grant for the extension.

## 2. Inputs
- chrome.runtime.onMessage from UI pages and content scripts
- chrome.tabs events (onUpdated, onRemoved)
- chrome.storage.local for state persistence
- navigator.storage.persist() requests

## 3. Outputs
- Message responses via sendResponse({ success, data/error })
- chrome.tabs.sendMessage to content scripts
- Dexie IndexedDB operations (projects, testRuns CRUD)

## 4. Internal Architecture
- src/background/background.ts (323 lines)
- Message router with 20+ action handlers (if/else chain)
- IndexedDB wrapper (DB.addProject, DB.getAllProjects, etc.)
- Tab tracking: trackedTabs Set, openedTabId for injection

## 5. Critical Dependencies
- Dexie.js 4.0.11 for IndexedDB
- chrome.runtime, chrome.tabs, chrome.storage, chrome.scripting APIs
- Service worker lifecycle (terminates after 30s inactivity)

## 6. Hidden Assumptions
- Background script always available (no offline queue)
- Service worker terminates gracefully (no mid-operation crashes)
- Tab IDs remain valid across messages (no stale tab ID checks)

## 7. Stability Concerns
- Service worker may terminate mid-database operation (transaction incomplete)
- No keepalive mechanism (chrome.alarms not implemented)
- 20+ action types in single if/else chain (hard to maintain)

## 8. Edge Cases
- Service worker restart: in-flight sendResponse callbacks invalidated
- Multiple tabs sending same action simultaneously: race condition on DB writes

## 9. Developer-Must-Know Notes
- Always `return true` in async onMessage handlers to keep sendResponse open
- Use chrome.alarms.create('keepalive', { periodInMinutes: 1 }) for long operations
- Consider switching to switch/case or action map for message routing:
  ```typescript
  const actionHandlers = {
    add_project: handleAddProject,
    get_all_projects: handleGetAllProjects,
    ...
  };
  actionHandlers[message.action]?.(message, sender, sendResponse);
  ```
