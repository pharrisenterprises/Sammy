# Background-Content Script Message Protocol

**Project:** Chrome Extension Test Recorder  
**Document Version:** 1.0  
**Status:** Complete Technical Specification  
**Last Updated:** November 2025

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Message Format Standards](#3-message-format-standards)
4. [Recording Messages](#4-recording-messages)
5. [Replay Messages](#5-replay-messages)
6. [State Management Messages](#6-state-management-messages)
7. [Sync Messages](#7-sync-messages)
8. [Message Handler Implementation](#8-message-handler-implementation)
9. [Error Codes & Handling](#9-error-codes--handling)
10. [Cross-Context Messaging](#10-cross-context-messaging)
11. [Best Practices](#11-best-practices)
12. [Testing Protocol](#12-testing-protocol)

---

## 1. Overview

This document defines the message protocol for communication between the Chrome Extension's background service worker and content scripts. The protocol enables:

- **Recording:** Capturing user interactions in web pages
- **Replay:** Executing recorded steps during test runs
- **State Sync:** Keeping UI and background state synchronized
- **Error Handling:** Propagating errors across contexts

### 1.1 Communication Contexts

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    EXTENSION MESSAGING ARCHITECTURE                     │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                         EXTENSION PAGES                                 │
│                                                                         │
│   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐                  │
│   │   Popup     │   │  Dashboard  │   │  Recorder   │                  │
│   │   (popup)   │   │   (tab)     │   │    (tab)    │                  │
│   └──────┬──────┘   └──────┬──────┘   └──────┬──────┘                  │
│          │                 │                 │                          │
│          └─────────────────┴─────────────────┘                          │
│                            │                                            │
│                 chrome.runtime.sendMessage()                            │
│                            │                                            │
└────────────────────────────┼────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    BACKGROUND SERVICE WORKER                            │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │                    MESSAGE ROUTER                                │  │
│   │                                                                   │  │
│   │  chrome.runtime.onMessage.addListener((message, sender) => {    │  │
│   │    switch(message.type) {                                        │  │
│   │      case 'START_RECORDING': ...                                 │  │
│   │      case 'STEP_CAPTURED': ...                                   │  │
│   │      case 'START_REPLAY': ...                                    │  │
│   │    }                                                             │  │
│   │  });                                                             │  │
│   └─────────────────────────────────────────────────────────────────┘  │
│                            │                                            │
│              chrome.tabs.sendMessage(tabId, ...)                        │
│                            │                                            │
└────────────────────────────┼────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      CONTENT SCRIPTS                                    │
│                                                                         │
│   ┌───────────────────────────────────────────────────────────────┐    │
│   │                    WEB PAGE CONTEXT                            │    │
│   │                                                                 │    │
│   │   chrome.runtime.onMessage.addListener(...)                    │    │
│   │                                                                 │    │
│   │   ┌─────────────────┐      ┌─────────────────┐                │    │
│   │   │ Event Listeners │      │  Step Executor  │                │    │
│   │   │  (Recording)    │      │   (Replay)      │                │    │
│   │   └─────────────────┘      └─────────────────┘                │    │
│   └───────────────────────────────────────────────────────────────┘    │
│                            │                                            │
│                 window.postMessage (page context)                       │
│                            │                                            │
│   ┌───────────────────────────────────────────────────────────────┐    │
│   │                  PAGE CONTEXT SCRIPT                           │    │
│   │           (Shadow DOM access, interceptors)                    │    │
│   └───────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 API Channels

| Channel | API | Direction | Use Case |
|---------|-----|-----------|----------|
| Extension → Background | `chrome.runtime.sendMessage()` | Bidirectional | Storage ops, state queries |
| Background → Content | `chrome.tabs.sendMessage(tabId)` | Bidirectional | Replay commands |
| Content → Background | `chrome.runtime.sendMessage()` | Bidirectional | Step capture, status |
| Content ↔ Page | `window.postMessage()` | Bidirectional | Shadow DOM events |

---

## 2. Architecture

### 2.1 Message Flow Patterns

#### Pattern 1: Request/Response (Async)

```typescript
// Sender (Extension Page)
const response = await chrome.runtime.sendMessage({
  type: 'GET_RECORDINGS',
  payload: { userId: 'user-123' }
});

if (response.success) {
  console.log('Recordings:', response.data);
} else {
  console.error('Error:', response.error);
}

// Receiver (Background)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_RECORDINGS') {
    getRecordings(message.payload.userId)
      .then(recordings => sendResponse({ success: true, data: recordings }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // CRITICAL: Keep channel open for async response
  }
});
```

#### Pattern 2: Fire-and-Forget Broadcast

```typescript
// Sender (Content Script) - No response expected
chrome.runtime.sendMessage({
  type: 'STEP_CAPTURED',
  payload: {
    recordingId: 'rec-123',
    step: { stepNumber: 1, event: 'click', selector: 'button#submit' }
  }
});

// Receiver (Background + Extension Pages) - All listeners receive
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'STEP_CAPTURED') {
    // Update UI, sync to Supabase, etc.
    handleStepCaptured(message.payload);
  }
});
```

#### Pattern 3: Tab-Targeted Command

```typescript
// Sender (Background → Specific Tab)
const result = await chrome.tabs.sendMessage(tabId, {
  type: 'EXECUTE_STEP',
  payload: {
    step: { event: 'click', selector: 'button#submit' },
    variables: { username: 'testuser' }
  }
});

// Receiver (Content Script in that tab)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EXECUTE_STEP') {
    executeStep(message.payload.step, message.payload.variables)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});
```

### 2.2 Component Responsibilities

| Component | Role | Responsibilities |
|-----------|------|------------------|
| Background | Central Router | Route messages, manage state, coordinate tabs |
| Popup | Quick Actions | Start/stop recording, show status |
| Dashboard | Full UI | List recordings, manage executions |
| Content Script | Page Interface | Capture events, execute steps |
| Page Script | Shadow Access | Access closed shadow roots |

---

## 3. Message Format Standards

### 3.1 Base Message Interface

```typescript
/**
 * Base interface for all messages in the extension.
 * All messages must have a type field for routing.
 */
interface BaseMessage<T = unknown> {
  /** Unique message type identifier (SCREAMING_SNAKE_CASE) */
  type: MessageType;
  
  /** Optional payload data specific to message type */
  payload?: T;
  
  /** ISO timestamp when message was created */
  timestamp?: string;
  
  /** Source context of the message */
  source?: 'background' | 'content' | 'popup' | 'dashboard' | 'page';
}
```

### 3.2 Response Interface

```typescript
/**
 * Standard response format for all request/response messages.
 */
interface MessageResponse<T = unknown> {
  /** Whether the operation succeeded */
  success: boolean;
  
  /** Response data (only if success=true) */
  data?: T;
  
  /** Error message (only if success=false) */
  error?: string;
  
  /** Error code for programmatic handling */
  errorCode?: ErrorCode;
  
  /** Additional error details */
  details?: Record<string, unknown>;
}
```

### 3.3 Message Type Registry

```typescript
/**
 * All message types used in the extension.
 * Grouped by category for organization.
 */
type MessageType =
  // Recording Control
  | 'START_RECORDING'
  | 'STOP_RECORDING'
  | 'PAUSE_RECORDING'
  | 'RESUME_RECORDING'
  | 'CANCEL_RECORDING'
  
  // Step Capture
  | 'STEP_CAPTURED'
  | 'STEP_UPDATED'
  | 'STEP_DELETED'
  
  // Recording State
  | 'GET_RECORDING_STATE'
  | 'RECORDING_STATE_CHANGED'
  | 'RECORDING_STATUS'
  
  // Replay Control
  | 'START_REPLAY'
  | 'STOP_REPLAY'
  | 'PAUSE_REPLAY'
  | 'RESUME_REPLAY'
  
  // Step Execution
  | 'EXECUTE_STEP'
  | 'STEP_EXECUTED'
  | 'STEP_FAILED'
  
  // Replay State
  | 'REPLAY_PROGRESS'
  | 'REPLAY_COMPLETE'
  | 'REPLAY_ERROR'
  
  // Sync Operations
  | 'SYNC_RECORDING'
  | 'SYNC_COMPLETE'
  | 'SYNC_ERROR'
  
  // Tab Management
  | 'TAB_READY'
  | 'TAB_NAVIGATED'
  | 'TAB_CLOSED'
  
  // Storage Operations
  | 'GET_RECORDINGS'
  | 'GET_RECORDING'
  | 'SAVE_RECORDING'
  | 'DELETE_RECORDING';
```

---

## 4. Recording Messages

### 4.1 START_RECORDING

Initiates a new recording session.

```typescript
interface StartRecordingMessage extends BaseMessage<StartRecordingPayload> {
  type: 'START_RECORDING';
  payload: StartRecordingPayload;
}

interface StartRecordingPayload {
  /** Name for the new recording */
  name: string;
  
  /** Starting URL to navigate to */
  startingUrl: string;
  
  /** Optional description */
  description?: string;
  
  /** Optional tags for organization */
  tags?: string[];
}

interface StartRecordingResponse extends MessageResponse<{
  /** UUID of the created recording */
  recordingId: string;
  
  /** Tab ID where recording is active */
  tabId: number;
}> {}
```

**Flow:**

```
Popup                    Background                Content Script
  │                          │                          │
  │  START_RECORDING         │                          │
  │─────────────────────────>│                          │
  │                          │                          │
  │                          │  Create recording (UUID) │
  │                          │  Save to Supabase        │
  │                          │                          │
  │                          │  chrome.tabs.create()    │
  │                          │─────────────────────────>│
  │                          │                          │
  │                          │  Inject content script   │
  │                          │─────────────────────────>│
  │                          │                          │
  │                          │  ATTACH_LISTENERS        │
  │                          │─────────────────────────>│
  │                          │                          │
  │                          │  { success: true }       │
  │                          │<─────────────────────────│
  │                          │                          │
  │  { recordingId, tabId }  │                          │
  │<─────────────────────────│                          │
```

### 4.2 STOP_RECORDING

Ends the current recording session.

```typescript
interface StopRecordingMessage extends BaseMessage<StopRecordingPayload> {
  type: 'STOP_RECORDING';
  payload: StopRecordingPayload;
}

interface StopRecordingPayload {
  /** ID of recording to stop */
  recordingId: string;
}

interface StopRecordingResponse extends MessageResponse<{
  /** Final recording data */
  recording: Recording;
  
  /** Total steps captured */
  stepCount: number;
  
  /** Duration in milliseconds */
  duration: number;
}> {}
```

### 4.3 STEP_CAPTURED

Sent when user performs an action during recording.

```typescript
interface StepCapturedMessage extends BaseMessage<StepCapturedPayload> {
  type: 'STEP_CAPTURED';
  payload: StepCapturedPayload;
}

interface StepCapturedPayload {
  /** Recording this step belongs to */
  recordingId: string;
  
  /** The captured step data */
  step: RecordedStep;
}

// No response expected (fire-and-forget)
```

### 4.4 RECORDING_STATUS

Query or broadcast recording status.

```typescript
interface RecordingStatusMessage extends BaseMessage<RecordingStatusPayload> {
  type: 'RECORDING_STATUS';
  payload: RecordingStatusPayload;
}

interface RecordingStatusPayload {
  /** Whether actively recording */
  isRecording: boolean;
  
  /** Current recording ID (if recording) */
  recordingId?: string;
  
  /** Current step count */
  stepCount: number;
  
  /** Active tab ID */
  tabId?: number;
  
  /** Current page URL */
  currentUrl?: string;
  
  /** Recording state */
  state: 'idle' | 'recording' | 'paused' | 'stopping';
}
```

---

## 5. Replay Messages

### 5.1 START_REPLAY

Initiates test execution for a recording.

```typescript
interface StartReplayMessage extends BaseMessage<StartReplayPayload> {
  type: 'START_REPLAY';
  payload: StartReplayPayload;
}

interface StartReplayPayload {
  /** Recording to replay */
  recordingId: string;
  
  /** Variable values for substitution */
  variables?: Record<string, string>;
  
  /** CSV row data (for batch execution) */
  rowData?: Record<string, string>;
  
  /** Row index in batch (0-based) */
  rowIndex?: number;
  
  /** Execution settings */
  settings?: {
    /** Timeout per step in ms */
    timeout?: number;
    
    /** Number of retries on failure */
    retryCount?: number;
    
    /** Take screenshot on error */
    screenshotOnError?: boolean;
    
    /** Enable AI healing */
    enableHealing?: boolean;
  };
}

interface StartReplayResponse extends MessageResponse<{
  /** Execution job ID */
  executionId: string;
  
  /** Tab ID for replay */
  tabId: number;
}> {}
```

### 5.2 EXECUTE_STEP

Command to execute a single step in the content script.

```typescript
interface ExecuteStepMessage extends BaseMessage<ExecuteStepPayload> {
  type: 'EXECUTE_STEP';
  payload: ExecuteStepPayload;
}

interface ExecuteStepPayload {
  /** Step to execute */
  step: RecordedStep;
  
  /** Current step index (0-based) */
  stepIndex: number;
  
  /** Total steps in recording */
  totalSteps: number;
  
  /** Variable values for substitution */
  variables?: Record<string, string>;
  
  /** Step timeout in ms */
  timeout?: number;
}

interface ExecuteStepResponse extends MessageResponse<{
  /** Whether step executed successfully */
  executed: boolean;
  
  /** Execution duration in ms */
  duration: number;
  
  /** Selector actually used (may differ if healed) */
  usedSelector?: string;
  
  /** Screenshot base64 (if captured) */
  screenshot?: string;
  
  /** Extracted data (if extraction step) */
  extractedData?: Record<string, string>;
}> {}
```

### 5.3 STEP_EXECUTED / STEP_FAILED

Broadcast after each step completes.

```typescript
interface StepExecutedMessage extends BaseMessage<StepExecutedPayload> {
  type: 'STEP_EXECUTED';
  payload: StepExecutedPayload;
}

interface StepExecutedPayload {
  /** Execution job ID */
  executionId: string;
  
  /** Step index completed */
  stepIndex: number;
  
  /** Step number (1-based) */
  stepNumber: number;
  
  /** Step label */
  label: string;
  
  /** Duration in ms */
  duration: number;
  
  /** Row index (batch mode) */
  rowIndex?: number;
}

interface StepFailedMessage extends BaseMessage<StepFailedPayload> {
  type: 'STEP_FAILED';
  payload: StepFailedPayload;
}

interface StepFailedPayload {
  /** Execution job ID */
  executionId: string;
  
  /** Step that failed */
  stepIndex: number;
  
  /** Step number (1-based) */
  stepNumber: number;
  
  /** Error message */
  error: string;
  
  /** Error code */
  errorCode: ErrorCode;
  
  /** Screenshot URL (if captured) */
  screenshotUrl?: string;
  
  /** Whether healing was attempted */
  healingAttempted?: boolean;
  
  /** Whether healing succeeded */
  healingSucceeded?: boolean;
  
  /** Row index (batch mode) */
  rowIndex?: number;
}
```

### 5.4 REPLAY_COMPLETE

Sent when all steps have been executed.

```typescript
interface ReplayCompleteMessage extends BaseMessage<ReplayCompletePayload> {
  type: 'REPLAY_COMPLETE';
  payload: ReplayCompletePayload;
}

interface ReplayCompletePayload {
  /** Execution job ID */
  executionId: string;
  
  /** Overall success */
  success: boolean;
  
  /** Steps completed */
  stepsCompleted: number;
  
  /** Steps failed */
  stepsFailed: number;
  
  /** Total duration in ms */
  duration: number;
  
  /** Row index (batch mode) */
  rowIndex?: number;
  
  /** Errors encountered */
  errors: Array<{
    stepIndex: number;
    error: string;
    errorCode: ErrorCode;
  }>;
}
```

### 5.5 REPLAY_PROGRESS

Progress update during replay.

```typescript
interface ReplayProgressMessage extends BaseMessage<ReplayProgressPayload> {
  type: 'REPLAY_PROGRESS';
  payload: ReplayProgressPayload;
}

interface ReplayProgressPayload {
  /** Execution job ID */
  executionId: string;
  
  /** Current step index */
  currentStep: number;
  
  /** Total steps */
  totalSteps: number;
  
  /** Current row (batch mode) */
  currentRow?: number;
  
  /** Total rows (batch mode) */
  totalRows?: number;
  
  /** Percentage complete */
  percentComplete: number;
  
  /** Current step label */
  currentLabel: string;
  
  /** Elapsed time in ms */
  elapsedTime: number;
}
```

---

## 6. State Management Messages

### 6.1 GET_RECORDING_STATE

Query the current recording/replay state.

```typescript
interface GetRecordingStateMessage extends BaseMessage {
  type: 'GET_RECORDING_STATE';
}

interface RecordingState {
  /** Recording mode */
  mode: 'idle' | 'recording' | 'replaying';
  
  /** Active recording ID */
  recordingId?: string;
  
  /** Active execution ID */
  executionId?: string;
  
  /** Active tab ID */
  tabId?: number;
  
  /** Current step count */
  stepCount: number;
  
  /** Is paused */
  isPaused: boolean;
  
  /** Sync status */
  syncStatus: 'synced' | 'syncing' | 'pending' | 'offline' | 'error';
  
  /** Pending sync count */
  pendingSyncCount: number;
}

interface GetRecordingStateResponse extends MessageResponse<RecordingState> {}
```

### 6.2 RECORDING_STATE_CHANGED

Broadcast when state changes.

```typescript
interface RecordingStateChangedMessage extends BaseMessage<RecordingState> {
  type: 'RECORDING_STATE_CHANGED';
  payload: RecordingState;
}
```

---

## 7. Sync Messages

### 7.1 SYNC_RECORDING

Trigger sync for a recording.

```typescript
interface SyncRecordingMessage extends BaseMessage<SyncRecordingPayload> {
  type: 'SYNC_RECORDING';
  payload: SyncRecordingPayload;
}

interface SyncRecordingPayload {
  /** Recording to sync */
  recordingId: string;
  
  /** Force sync even if no changes */
  force?: boolean;
}

interface SyncRecordingResponse extends MessageResponse<{
  /** Sync completed successfully */
  synced: boolean;
  
  /** Server timestamp */
  syncedAt: string;
  
  /** Conflict resolved */
  conflictResolved?: boolean;
}> {}
```

### 7.2 SYNC_COMPLETE / SYNC_ERROR

Broadcast after sync operations.

```typescript
interface SyncCompleteMessage extends BaseMessage<SyncCompletePayload> {
  type: 'SYNC_COMPLETE';
  payload: SyncCompletePayload;
}

interface SyncCompletePayload {
  /** Recording that was synced */
  recordingId: string;
  
  /** Server timestamp */
  syncedAt: string;
}

interface SyncErrorMessage extends BaseMessage<SyncErrorPayload> {
  type: 'SYNC_ERROR';
  payload: SyncErrorPayload;
}

interface SyncErrorPayload {
  /** Recording that failed to sync */
  recordingId: string;
  
  /** Error message */
  error: string;
  
  /** Is retryable */
  retryable: boolean;
  
  /** Retry count so far */
  retryCount: number;
}
```

---

## 8. Message Handler Implementation

### 8.1 Background Service Worker

```typescript
// src/background/message-router.ts

import { MessageType, BaseMessage, MessageResponse } from '../types/messages';

type MessageHandler<T = unknown, R = unknown> = (
  payload: T,
  sender: chrome.runtime.MessageSender
) => Promise<MessageResponse<R>>;

class MessageRouter {
  private handlers = new Map<MessageType, MessageHandler>();

  register<T, R>(type: MessageType, handler: MessageHandler<T, R>): void {
    this.handlers.set(type, handler as MessageHandler);
  }

  initialize(): void {
    chrome.runtime.onMessage.addListener(
      (message: BaseMessage, sender, sendResponse) => {
        this.handleMessage(message, sender, sendResponse);
        return true; // Keep channel open for async response
      }
    );
  }

  private async handleMessage(
    message: BaseMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void
  ): Promise<void> {
    const { type, payload } = message;

    console.log(`[MessageRouter] Received: ${type}`, { payload, sender });

    const handler = this.handlers.get(type);

    if (!handler) {
      console.warn(`[MessageRouter] No handler for type: ${type}`);
      sendResponse({
        success: false,
        error: `Unknown message type: ${type}`,
        errorCode: 'ERR_UNKNOWN_MESSAGE'
      });
      return;
    }

    try {
      const response = await handler(payload, sender);
      sendResponse(response);
    } catch (error) {
      console.error(`[MessageRouter] Handler error for ${type}:`, error);
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: 'ERR_HANDLER_FAILED'
      });
    }
  }
}

// Usage
const router = new MessageRouter();

router.register('START_RECORDING', async (payload, sender) => {
  const recording = await createRecording(payload);
  const tab = await chrome.tabs.create({ url: payload.startingUrl });
  await injectContentScript(tab.id);
  
  return {
    success: true,
    data: { recordingId: recording.id, tabId: tab.id }
  };
});

router.register('STOP_RECORDING', async (payload) => {
  const recording = await stopRecording(payload.recordingId);
  return {
    success: true,
    data: {
      recording,
      stepCount: recording.steps.length,
      duration: recording.duration
    }
  };
});

router.initialize();
```

### 8.2 Content Script Handler

```typescript
// src/content-script/message-handler.ts

import { BaseMessage, MessageResponse } from '../types/messages';

class ContentMessageHandler {
  private recorder: RecordingEngine;
  private replayer: ReplayEngine;

  initialize(): void {
    chrome.runtime.onMessage.addListener(
      (message: BaseMessage, sender, sendResponse) => {
        this.handleMessage(message, sender, sendResponse);
        return true;
      }
    );
  }

  private async handleMessage(
    message: BaseMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void
  ): Promise<void> {
    const { type, payload } = message;

    try {
      switch (type) {
        case 'ATTACH_LISTENERS':
          this.recorder.attach();
          sendResponse({ success: true });
          break;

        case 'DETACH_LISTENERS':
          this.recorder.detach();
          sendResponse({ success: true });
          break;

        case 'EXECUTE_STEP':
          const result = await this.replayer.executeStep(
            payload.step,
            payload.variables,
            payload.timeout
          );
          sendResponse({ success: true, data: result });
          break;

        case 'HIGHLIGHT_ELEMENT':
          this.highlightElement(payload.selector);
          sendResponse({ success: true });
          break;

        default:
          sendResponse({
            success: false,
            error: `Unknown message type: ${type}`,
            errorCode: 'ERR_UNKNOWN_MESSAGE'
          });
      }
    } catch (error) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: 'ERR_EXECUTION_FAILED'
      });
    }
  }
}
```

---

## 9. Error Codes & Handling

### 9.1 Error Code Registry

```typescript
/**
 * Standardized error codes for programmatic handling.
 */
type ErrorCode =
  // Recording Errors
  | 'ERR_NOT_RECORDING'        // No active recording
  | 'ERR_ALREADY_RECORDING'    // Recording already in progress
  | 'ERR_RECORDING_NOT_FOUND'  // Recording ID doesn't exist
  | 'ERR_RECORDING_LOCKED'     // Recording is being edited elsewhere
  
  // Replay Errors
  | 'ERR_NOT_REPLAYING'        // No active replay
  | 'ERR_ALREADY_REPLAYING'    // Replay already in progress
  | 'ERR_ELEMENT_NOT_FOUND'    // Target element not in DOM
  | 'ERR_ELEMENT_NOT_VISIBLE'  // Element exists but not visible
  | 'ERR_ELEMENT_NOT_INTERACTABLE' // Element blocked by overlay
  | 'ERR_ACTION_FAILED'        // Click/type/select failed
  | 'ERR_NAVIGATION_FAILED'    // Page navigation failed
  | 'ERR_TIMEOUT'              // Operation timed out
  
  // Tab Errors
  | 'ERR_TAB_NOT_FOUND'        // Tab ID doesn't exist
  | 'ERR_TAB_CLOSED'           // Tab was closed during operation
  | 'ERR_CONTENT_SCRIPT'       // Content script not injected
  
  // Sync Errors
  | 'ERR_SYNC_FAILED'          // Supabase sync failed
  | 'ERR_NETWORK'              // Network error
  | 'ERR_UNAUTHORIZED'         // Auth token expired
  | 'ERR_CONFLICT'             // Sync conflict detected
  
  // General Errors
  | 'ERR_UNKNOWN_MESSAGE'      // Message type not recognized
  | 'ERR_HANDLER_FAILED'       // Handler threw exception
  | 'ERR_VALIDATION'           // Payload validation failed
  | 'ERR_INTERNAL';            // Internal error
```

### 9.2 Error Handling Patterns

```typescript
// Sender-side error handling
async function sendMessage<T>(
  type: MessageType,
  payload?: unknown
): Promise<T> {
  try {
    const response = await chrome.runtime.sendMessage({ type, payload });
    
    if (!response.success) {
      throw new ExtensionError(response.error, response.errorCode);
    }
    
    return response.data as T;
  } catch (error) {
    // Check for Chrome runtime errors
    if (chrome.runtime.lastError) {
      throw new ExtensionError(
        chrome.runtime.lastError.message,
        'ERR_RUNTIME'
      );
    }
    throw error;
  }
}

// Custom error class
class ExtensionError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode
  ) {
    super(message);
    this.name = 'ExtensionError';
  }
}
```

---

## 10. Cross-Context Messaging

### 10.1 Page Context Bridge

For accessing closed shadow roots and intercepting events:

```typescript
// Page context script (injected into page)
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data.source !== 'testflow-content') return;
  
  const { type, payload } = event.data;
  
  switch (type) {
    case 'GET_SHADOW_ELEMENT':
      const element = findInShadowRoots(payload.selector);
      window.postMessage({
        source: 'testflow-page',
        type: 'SHADOW_ELEMENT_RESULT',
        payload: { found: !!element, selector: payload.selector }
      }, '*');
      break;
  }
});

// Content script receiving from page
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data.source !== 'testflow-page') return;
  
  const { type, payload } = event.data;
  
  if (type === 'AUTOCOMPLETE_INPUT') {
    // Forward to background
    chrome.runtime.sendMessage({
      type: 'STEP_CAPTURED',
      payload: {
        recordingId: currentRecordingId,
        step: createStepFromAutocomplete(payload)
      }
    });
  }
});
```

### 10.2 Security Considerations

```typescript
// Always validate message origin
window.addEventListener('message', (event) => {
  // Only accept messages from same window
  if (event.source !== window) return;
  
  // Only accept messages from our page script
  if (event.data.source !== 'testflow-page') return;
  
  // Validate expected message structure
  if (!event.data.type || typeof event.data.type !== 'string') return;
  
  // Process message...
});
```

---

## 11. Best Practices

### 11.1 Always Return True for Async Handlers

```typescript
// ✅ CORRECT: Returns true for async operations
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ASYNC_OPERATION') {
    performAsyncOperation()
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // CRITICAL
  }
});

// ❌ WRONG: Channel closes before async completes
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ASYNC_OPERATION') {
    performAsyncOperation()
      .then(result => sendResponse({ success: true, data: result }));
    // Missing return true!
  }
});
```

### 11.2 Check for Runtime Errors

```typescript
const response = await chrome.runtime.sendMessage(message);

if (chrome.runtime.lastError) {
  console.error('Runtime error:', chrome.runtime.lastError.message);
  // Handle: content script not loaded, tab closed, etc.
}
```

### 11.3 Validate Sender

```typescript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Only accept from our extension
  if (sender.id !== chrome.runtime.id) {
    sendResponse({ success: false, error: 'Unauthorized sender' });
    return false;
  }
  
  // For tab-specific operations, verify tab ID
  if (message.type === 'STEP_CAPTURED' && !sender.tab?.id) {
    sendResponse({ success: false, error: 'Missing tab context' });
    return false;
  }
});
```

### 11.4 Add Timeouts

```typescript
function sendMessageWithTimeout<T>(
  message: BaseMessage,
  timeoutMs: number = 30000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new ExtensionError('Message timeout', 'ERR_TIMEOUT'));
    }, timeoutMs);
    
    chrome.runtime.sendMessage(message, (response) => {
      clearTimeout(timer);
      if (response?.success) {
        resolve(response.data);
      } else {
        reject(new ExtensionError(response?.error || 'Unknown error', response?.errorCode));
      }
    });
  });
}
```

---

## 12. Testing Protocol

### 12.1 Unit Test Examples

```typescript
describe('Message Router', () => {
  let router: MessageRouter;
  let mockSendResponse: jest.Mock;

  beforeEach(() => {
    router = new MessageRouter();
    mockSendResponse = jest.fn();
  });

  it('should route START_RECORDING to handler', async () => {
    const handler = jest.fn().mockResolvedValue({
      success: true,
      data: { recordingId: 'rec-123', tabId: 1 }
    });
    
    router.register('START_RECORDING', handler);
    
    await router.handleMessage(
      { type: 'START_RECORDING', payload: { name: 'Test', startingUrl: 'https://example.com' } },
      { id: 'extension-id' } as chrome.runtime.MessageSender,
      mockSendResponse
    );
    
    expect(handler).toHaveBeenCalledWith(
      { name: 'Test', startingUrl: 'https://example.com' },
      expect.any(Object)
    );
    expect(mockSendResponse).toHaveBeenCalledWith({
      success: true,
      data: { recordingId: 'rec-123', tabId: 1 }
    });
  });

  it('should handle unknown message type', async () => {
    await router.handleMessage(
      { type: 'UNKNOWN_TYPE' as MessageType },
      {} as chrome.runtime.MessageSender,
      mockSendResponse
    );
    
    expect(mockSendResponse).toHaveBeenCalledWith({
      success: false,
      error: 'Unknown message type: UNKNOWN_TYPE',
      errorCode: 'ERR_UNKNOWN_MESSAGE'
    });
  });
});
```

### 12.2 Integration Test Checklist

```
☐ START_RECORDING creates recording and opens tab
☐ STEP_CAPTURED adds step to recording
☐ STOP_RECORDING finalizes recording with correct step count
☐ EXECUTE_STEP clicks element correctly
☐ EXECUTE_STEP types text with variable substitution
☐ STEP_FAILED includes error details and screenshot
☐ REPLAY_COMPLETE has accurate statistics
☐ Messages work across tab navigation
☐ Errors propagate correctly to sender
☐ Timeout handling works for slow operations
```

---

## Document End

This protocol specification ensures consistent, reliable communication between all components of the Chrome Extension Test Recorder.
