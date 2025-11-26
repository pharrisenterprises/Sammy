# Recording Engine Overview
**Project:** Chrome Extension Test Recorder  
**Document Version:** 1.0  
**Last Updated:** November 22, 2025  
**Status:** Complete Architecture Overview

## Table of Contents
1. Overview
2. Recording Engine Architecture
3. Component Relationships
4. Data Flow Summary
5. Integration Points
6. Configuration Options
7. Recording Lifecycle
8. Performance Considerations
9. Error Handling Strategy
10. Testing Approach

---

## 1. Overview

### 1.1 Purpose

The **Recording Engine** is responsible for capturing user interactions on web pages and converting them into a structured, replayable format. It is the foundation of the entire test automation system.

### 1.2 Key Responsibilities

1. **Event Capture** - Listen for user interactions (clicks, inputs, navigation)
2. **Label Detection** - Identify human-readable labels for elements
3. **Locator Generation** - Create robust selectors for element finding
4. **Context Enrichment** - Capture metadata (iframes, shadows, scroll position)
5. **Step Serialization** - Convert events to structured JSON format

### 1.3 Design Goals

- ✅ **Accuracy** - Capture exact user intent
- ✅ **Robustness** - Generate selectors that survive page changes
- ✅ **Performance** - Minimal impact on page performance
- ✅ **Compatibility** - Work across all modern web pages
- ✅ **Isolation** - No interference with page JavaScript

---

## 2. Recording Engine Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        RECORDING ENGINE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │              1. CONTENT SCRIPT SYSTEM                     │ │
│  │              - Script injection                           │ │
│  │              - Isolated world execution                   │ │
│  │              - Iframe traversal                           │ │
│  │              - Shadow DOM handling                        │ │
│  └───────────────────────────────────────────────────────────┘ │
│                             ↓                                   │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │              2. EVENT CAPTURE                             │ │
│  │              - DOM event listeners (click, input, keyboard)│ │
│  │              - Event filtering (synthetic, spam, invalid) │ │
│  │              - Event serialization                        │ │
│  │              - Debouncing/throttling                      │ │
│  └───────────────────────────────────────────────────────────┘ │
│                             ↓                                   │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │              3. LABEL DETECTION                           │ │
│  │              - 12 heuristics (ARIA, placeholder, etc.)    │ │
│  │              - Priority ordering                          │ │
│  │              - Label sanitization                         │ │
│  └───────────────────────────────────────────────────────────┘ │
│                             ↓                                   │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │              4. LOCATOR GENERATION                        │ │
│  │              - 9 locator strategies (XPath, ID, CSS, etc.)│ │
│  │              - LocatorBundle structure                    │ │
│  │              - Priority scoring                           │ │
│  └───────────────────────────────────────────────────────────┘ │
│                             ↓                                   │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │              5. CONTEXT ENRICHMENT                        │ │
│  │              - Iframe chain tracking                      │ │
│  │              - Shadow host tracking                       │ │
│  │              - Scroll position capture                    │ │
│  │              - Visibility detection                       │ │
│  │              - Tab context tracking                       │ │
│  └───────────────────────────────────────────────────────────┘ │
│                             ↓                                   │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │               OUTPUT: RecordedStep                        │ │
│  │              {                                            │ │
│  │                stepNumber: 1,                             │ │
│  │                event: 'click',                            │ │
│  │                selector: 'button#submit',                 │ │
│  │                label: 'Submit Button',                    │ │
│  │                bundle: { /* 9 locators */ },              │ │
│  │                metadata: { /* context */ }                │ │
│  │              }                                            │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Component Layers

**Layer 1: Content Script System** (Foundation)
- Manages script lifecycle
- Handles iframe injection
- Deals with Shadow DOM
- Provides isolated execution context

**Layer 2: Event Capture** (Input)
- Listens for DOM events
- Filters noise
- Serializes event data
- Manages event queue

**Layer 3: Label Detection** (Enhancement)
- Finds human-readable labels
- Applies 12 heuristics
- Prioritizes best match
- Sanitizes output

**Layer 4: Locator Generation** (Core)
- Creates 9 different selectors
- Builds LocatorBundle
- Scores selector reliability
- Optimizes for replay

**Layer 5: Context Enrichment** (Metadata)
- Captures execution context
- Tracks complex DOM structures
- Records environmental state
- Enables accurate replay

---

## 3. Component Relationships

### 3.1 Module Dependencies

```
┌─────────────────────────────────────────────────────────────────┐
│                  Background Service Worker                      │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Recording Manager                          │   │
│  │              - Start/stop recording                     │   │
│  │              - Step aggregation                         │   │
│  │              - Storage coordination                     │   │
│  └─────────────────────┬───────────────────────────────────┘   │
└────────────────────────┼───────────────────────────────────────┘
                         │
                         │ chrome.runtime.sendMessage
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                       Content Script                            │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              EventCapture                               │   │
│  │              - Listens for DOM events                   │   │
│  │              - Filters synthetic events                 │   │
│  └─────────────────────┬───────────────────────────────────┘   │
│                        │                                        │
│                        ↓                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              LabelDetector                              │   │
│  │              - Finds element label                      │   │
│  │              - Uses 12 heuristics                       │   │
│  └─────────────────────┬───────────────────────────────────┘   │
│                        │                                        │
│                        ↓                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              LocatorGenerator                           │   │
│  │              - Creates 9 selectors                      │   │
│  │              - Builds LocatorBundle                     │   │
│  └─────────────────────┬───────────────────────────────────┘   │
│                        │                                        │
│                        ↓                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              ContextEnricher                            │   │
│  │              - Captures metadata                        │   │
│  │              - Tracks iframe/shadow                     │   │
│  └─────────────────────┬───────────────────────────────────┘   │
│                        │                                        │
│                        ↓                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              StepSerializer                             │   │
│  │              - Converts to RecordedStep                 │   │
│  │              - Validates structure                      │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Data Flow Between Components

```typescript
// 1. User clicks button on page
window.addEventListener('click', handleClick);

// 2. EventCapture filters and processes
function handleClick(event: MouseEvent) {
  if (isRecording && !isSynthetic(event)) {
    const element = event.target as HTMLElement;
    
    // 3. LabelDetector finds label
    const label = LabelDetector.detect(element);
    
    // 4. LocatorGenerator creates selectors
    const bundle = LocatorGenerator.generate(element);
    
    // 5. ContextEnricher adds metadata
    const metadata = ContextEnricher.capture(element);
    
    // 6. StepSerializer builds RecordedStep
    const step = StepSerializer.serialize({
      event: 'click',
      element,
      label,
      bundle,
      metadata
    });
    
    // 7. Send to background
    chrome.runtime.sendMessage({
      action: 'ADD_STEP',
      payload: { step }
    });
  }
}
```

---

## 4. Data Flow Summary

### 4.1 Recording Flow

```
┌─────────────┐
│ User clicks │
│   button    │
└──────┬──────┘
       │
       ↓
┌─────────────────────────────────────────────────────────┐
│ DOM Event (click, input, keydown, navigation)           │
└──────┬──────────────────────────────────────────────────┘
       │
       ↓
┌─────────────────────────────────────────────────────────┐
│ Content Script: Event Listener                          │
│ - Captures event                                        │
│ - Checks if recording active                            │
│ - Filters synthetic events                              │
└──────┬──────────────────────────────────────────────────┘
       │
       ↓
┌─────────────────────────────────────────────────────────┐
│ Label Detection (12 heuristics)                         │
│ - aria-label                                            │
│ - placeholder                                           │
│ - associated <label>                                    │
│ - visible text                                          │
│ - etc.                                                  │
└──────┬──────────────────────────────────────────────────┘
       │
       ↓
┌─────────────────────────────────────────────────────────┐
│ Locator Generation (9 strategies)                       │
│ - XPath (absolute)                                      │
│ - ID selector                                           │
│ - Name attribute                                        │
│ - ARIA attributes                                       │
│ - CSS selector                                          │
│ - Data attributes                                       │
│ - Text content                                          │
│ - Placeholder                                           │
│ - Bounding box                                          │
└──────┬──────────────────────────────────────────────────┘
       │
       ↓
┌─────────────────────────────────────────────────────────┐
│ Context Enrichment                                      │
│ - Iframe chain: ['frame1', 'frame2']                    │
│ - Shadow hosts: ['#app', '#dialog']                     │
│ - Scroll position: {x: 0, y: 100}                       │
│ - Visibility: true                                      │
│ - Tab ID: 123                                           │
└──────┬──────────────────────────────────────────────────┘
       │
       ↓
┌─────────────────────────────────────────────────────────┐
│ RecordedStep Object                                     │
│ {                                                       │
│   stepNumber: 1,                                        │
│   event: 'click',                                       │
│   selector: 'button#submit',                            │
│   label: 'Submit Button',                               │
│   bundle: { xpath, id, name, ... },                     │
│   metadata: { iframe, shadow, scroll, ... }             │
│ }                                                       │
└──────┬──────────────────────────────────────────────────┘
       │
       ↓
┌─────────────────────────────────────────────────────────┐
│ Send to Background Service Worker                       │
│ chrome.runtime.sendMessage({ action: 'ADD_STEP' })     │
└──────┬──────────────────────────────────────────────────┘
       │
       ↓
┌─────────────────────────────────────────────────────────┐
│ Background Aggregates Steps                             │
│ - Adds to current recording                             │
│ - Updates step count                                    │
│ - Notifies popup UI                                     │
└──────┬──────────────────────────────────────────────────┘
       │
       ↓
┌─────────────────────────────────────────────────────────┐
│ Storage Service Saves to Supabase                       │
│ - Batch insert or sync queue                            │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Step Data Structure

Complete RecordedStep structure:

```typescript
interface RecordedStep {
  // Core identification
  stepNumber: number;           // Sequential step index (1-based)
  timestamp: number;            // Unix timestamp (ms)
  
  // Human-readable label
  label?: string;               // e.g., "Email Address", "Submit Button"
  
  // Event details
  event: string;                // 'click', 'type', 'select', 'navigate', etc.
  selector?: string;            // Primary selector (usually XPath)
  value?: any;                  // Input value (for 'type' events)
  
  // Mouse position (for click events)
  x?: number;
  y?: number;
  
  // Page context
  page: string;                 // Current URL
  navigation: {
    type: string;               // 'same_page', 'url', 'reload'
    url?: string;               // Target URL (if navigation)
  };
  
  // Tab context
  tabId?: number;               // Chrome tab ID
  
  // Metadata
  metadata?: {
    elementTag: string;         // 'button', 'input', 'a', etc.
    elementType?: string;       // 'submit', 'email', 'checkbox', etc.
    isInIframe: boolean;
    iframeDepth: number;
    isInShadowDOM: boolean;
    visibilityState: string;    // 'visible', 'hidden', 'offscreen'
    scrollPosition: { x: number; y: number };
  };
  
  // Locator bundle (9 strategies)
  bundle: {
    xpath: string;              // Absolute XPath
    id?: string;                // ID selector
    name?: string;              // Name attribute
    className?: string;         // CSS classes
    aria?: string;              // ARIA label
    placeholder?: string;       // Placeholder text
    dataAttrs?: Record<string, string>; // data-* attributes
    tag: string;                // Element tag name
    visibleText?: string;       // Visible text content
    bounding?: {                // Element position
      left: number;
      top: number;
      width: number;
      height: number;
    };
    iframeChain: string[];      // ['#frame1', '#frame2']
    shadowHosts: string[];      // ['#app', '#dialog']
    isClosedShadow?: boolean;   // Shadow root mode
  };
}
```

---

## 5. Integration Points

### 5.1 Background Service Worker

Recording Manager:

```typescript
// background.ts
class RecordingManager {
  private currentRecording: Recording | null = null;
  private stepCounter: number = 0;
  
  startRecording(name: string, startingUrl: string) {
    this.currentRecording = {
      id: crypto.randomUUID(),
      name,
      startingUrl,
      steps: [],
      createdAt: Date.now()
    };
    
    this.stepCounter = 0;
    
    // Notify content scripts to start capturing
    chrome.tabs.query({ active: true }, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id!, {
          action: 'START_CAPTURING'
        });
      });
    });
  }
  
  addStep(step: RecordedStep) {
    if (!this.currentRecording) return;
    
    step.stepNumber = ++this.stepCounter;
    this.currentRecording.steps.push(step);
    
    // Notify popup of new step
    chrome.runtime.sendMessage({
      action: 'STEP_ADDED',
      payload: { stepNumber: step.stepNumber }
    });
  }
  
  stopRecording() {
    if (!this.currentRecording) return;
    
    // Save to database
    saveRecording(this.currentRecording);
    
    // Notify content scripts to stop capturing
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id!, {
          action: 'STOP_CAPTURING'
        });
      });
    });
    
    const recording = this.currentRecording;
    this.currentRecording = null;
    this.stepCounter = 0;
    
    return recording;
  }
}
```

### 5.2 Popup UI

Recording Controls:

```typescript
// popup/src/components/RecordingControls.tsx
function RecordingControls() {
  const [isRecording, setIsRecording] = useState(false);
  const [stepCount, setStepCount] = useState(0);
  
  useEffect(() => {
    // Listen for step added events
    chrome.runtime.onMessage.addListener((message) => {
      if (message.action === 'STEP_ADDED') {
        setStepCount(message.payload.stepNumber);
      }
    });
  }, []);
  
  async function startRecording() {
    const response = await chrome.runtime.sendMessage({
      action: 'START_RECORDING',
      payload: {
        name: 'New Recording',
        startingUrl: window.location.href
      }
    });
    
    if (response.success) {
      setIsRecording(true);
      setStepCount(0);
    }
  }
  
  async function stopRecording() {
    const response = await chrome.runtime.sendMessage({
      action: 'STOP_RECORDING'
    });
    
    if (response.success) {
      setIsRecording(false);
      // Navigate to recording detail page
    }
  }
  
  return (
    <div>
      {isRecording ? (
        <>
          <div>Recording... ({stepCount} steps)</div>
          <button onClick={stopRecording}>Stop</button>
        </>
      ) : (
        <button onClick={startRecording}>Start Recording</button>
      )}
    </div>
  );
}
```

### 5.3 Storage Service

Save Recording:

```typescript
// services/storage.ts
async function saveRecording(recording: Recording): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  const { error } = await supabase
    .from('recordings')
    .insert({
      id: recording.id,
      user_id: user.id,
      name: recording.name,
      starting_url: recording.startingUrl,
      steps: recording.steps,
      step_count: recording.steps.length,
      status: 'ready',
      recording_method: 'extension'
    });
  
  if (error) {
    throw new Error(`Failed to save recording: ${error.message}`);
  }
  
  console.log('[Storage] Recording saved:', recording.id);
}
```

---

## 6. Configuration Options

### 6.1 Recording Settings

```typescript
interface RecordingConfig {
  // Event capture
  captureClicks: boolean;           // Default: true
  captureInputs: boolean;           // Default: true
  captureNavigation: boolean;       // Default: true
  captureKeyboard: boolean;         // Default: false
  
  // Filtering
  ignoreHiddenElements: boolean;    // Default: true
  ignoreSyntheticEvents: boolean;   // Default: true
  debounceInputMs: number;          // Default: 500
  
  // Label detection
  labelHeuristics: string[];        // Which heuristics to use
  labelMaxLength: number;           // Default: 50
  
  // Locator generation
  locatorStrategies: string[];      // Which strategies to use
  preferStableSelectors: boolean;   // Prefer ID/name over XPath
  
  // Context enrichment
  captureScreenshots: boolean;      // Default: false (expensive)
  capturePageSource: boolean;       // Default: false (expensive)
  trackScrollPosition: boolean;     // Default: true
  
  // Performance
  maxStepsPerRecording: number;     // Default: 1000
  throttleEventMs: number;          // Default: 100
}
```

### 6.2 User Preferences

Stored in chrome.storage.local:

```typescript
const DEFAULT_CONFIG: RecordingConfig = {
  captureClicks: true,
  captureInputs: true,
  captureNavigation: true,
  captureKeyboard: false,
  ignoreHiddenElements: true,
  ignoreSyntheticEvents: true,
  debounceInputMs: 500,
  labelHeuristics: ['aria', 'placeholder', 'label', 'text'],
  labelMaxLength: 50,
  locatorStrategies: ['xpath', 'id', 'name', 'aria', 'css'],
  preferStableSelectors: true,
  captureScreenshots: false,
  capturePageSource: false,
  trackScrollPosition: true,
  maxStepsPerRecording: 1000,
  throttleEventMs: 100
};

// Load config
async function loadConfig(): Promise<RecordingConfig> {
  const stored = await chrome.storage.local.get('recordingConfig');
  return { ...DEFAULT_CONFIG, ...stored.recordingConfig };
}

// Save config
async function saveConfig(config: Partial<RecordingConfig>): Promise<void> {
  const current = await loadConfig();
  const updated = { ...current, ...config };
  await chrome.storage.local.set({ recordingConfig: updated });
}
```

---

## 7. Recording Lifecycle

### 7.1 Lifecycle States

```typescript
enum RecordingState {
  IDLE = 'idle',                    // Not recording
  STARTING = 'starting',            // Initializing
  RECORDING = 'recording',          // Actively capturing
  PAUSED = 'paused',                // Temporarily paused
  STOPPING = 'stopping',            // Finalizing
  COMPLETE = 'complete'             // Finished
}
```

### 7.2 State Transitions

```
    ┌──────┐
    │ IDLE │
    └───┬──┘
        │ User clicks "Start"
        ↓
  ┌──────────┐
  │ STARTING │ (Inject content scripts, initialize listeners)
  └─────┬────┘
        │ Content scripts ready
        ↓
  ┌───────────┐
  │ RECORDING │◄──────┐
  └─────┬─────┘       │ User clicks "Resume"
        │             │
        │ User clicks │
        │  "Pause"    │
        ↓             │
   ┌────────┐         │
   │ PAUSED │─────────┘
   └────────┘
        │
        │ User clicks "Stop"
        ↓
  ┌──────────┐
  │ STOPPING │ (Remove listeners, serialize data)
  └─────┬────┘
        │ Save complete
        ↓
  ┌──────────┐
  │ COMPLETE │
  └──────────┘
        │ Navigate away or reset
        ↓
    ┌──────┐
    │ IDLE │
    └──────┘
```

### 7.3 Lifecycle Event Handlers

```typescript
class RecordingLifecycle {
  private state: RecordingState = RecordingState.IDLE;
  private eventListeners: Map<string, EventListener> = new Map();
  
  async start() {
    if (this.state !== RecordingState.IDLE) {
      throw new Error('Cannot start: already recording');
    }
    
    this.state = RecordingState.STARTING;
    
    // Inject content scripts
    await this.injectContentScripts();
    
    // Attach event listeners
    this.attachListeners();
    
    this.state = RecordingState.RECORDING;
    console.log('[Recording] Started');
  }
  
  pause() {
    if (this.state !== RecordingState.RECORDING) {
      throw new Error('Cannot pause: not recording');
    }
    
    this.state = RecordingState.PAUSED;
    console.log('[Recording] Paused');
  }
  
  resume() {
    if (this.state !== RecordingState.PAUSED) {
      throw new Error('Cannot resume: not paused');
    }
    
    this.state = RecordingState.RECORDING;
    console.log('[Recording] Resumed');
  }
  
  async stop() {
    if (this.state !== RecordingState.RECORDING && 
        this.state !== RecordingState.PAUSED) {
      throw new Error('Cannot stop: not recording');
    }
    
    this.state = RecordingState.STOPPING;
    
    // Detach event listeners
    this.detachListeners();
    
    // Save recording
    await this.saveRecording();
    
    this.state = RecordingState.COMPLETE;
    console.log('[Recording] Stopped');
    
    // Reset to idle
    setTimeout(() => {
      this.state = RecordingState.IDLE;
    }, 100);
  }
  
  private attachListeners() {
    const clickListener = (e: MouseEvent) => this.handleClick(e);
    const inputListener = (e: InputEvent) => this.handleInput(e);
    
    document.addEventListener('click', clickListener, true);
    document.addEventListener('input', inputListener, true);
    
    this.eventListeners.set('click', clickListener);
    this.eventListeners.set('input', inputListener);
  }
  
  private detachListeners() {
    this.eventListeners.forEach((listener, event) => {
      document.removeEventListener(event, listener, true);
    });
    this.eventListeners.clear();
  }
}
```

---

## 8. Performance Considerations

### 8.1 Event Throttling

Prevent overwhelming the system:

```typescript
class EventThrottler {
  private lastEventTime: number = 0;
  private minInterval: number = 100; // ms
  
  shouldProcess(eventType: string): boolean {
    const now = Date.now();
    
    if (now - this.lastEventTime < this.minInterval) {
      console.log(`[Throttle] Skipped ${eventType} (too soon)`);
      return false;
    }
    
    this.lastEventTime = now;
    return true;
  }
}
```

### 8.2 Input Debouncing

Wait for user to finish typing:

```typescript
class InputDebouncer {
  private timers: Map<HTMLElement, NodeJS.Timeout> = new Map();
  private delay: number = 500; // ms
  
  debounce(element: HTMLElement, callback: () => void) {
    // Clear existing timer
    const existingTimer = this.timers.get(element);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    // Set new timer
    const timer = setTimeout(() => {
      callback();
      this.timers.delete(element);
    }, this.delay);
    
    this.timers.set(element, timer);
  }
}
```

### 8.3 Memory Management

Limit recording size:

```typescript
const MAX_STEPS = 1000;
const MAX_STEP_SIZE = 10 * 1024; // 10KB per step

function validateStep(step: RecordedStep): boolean {
  // Check step count
  if (currentRecording.steps.length >= MAX_STEPS) {
    console.warn('[Recording] Max steps reached');
    return false;
  }
  
  // Check step size
  const size = JSON.stringify(step).length;
  if (size > MAX_STEP_SIZE) {
    console.warn('[Recording] Step too large:', size);
    return false;
  }
  
  return true;
}
```

---

## 9. Error Handling Strategy

### 9.1 Graceful Degradation

Handle errors without breaking recording:

```typescript
async function captureStep(event: Event) {
  try {
    const element = event.target as HTMLElement;
    
    // Try to detect label
    let label: string;
    try {
      label = LabelDetector.detect(element);
    } catch (error) {
      console.warn('[Recording] Label detection failed:', error);
      label = 'Unknown'; // Fallback
    }
    
    // Try to generate locators
    let bundle: LocatorBundle;
    try {
      bundle = LocatorGenerator.generate(element);
    } catch (error) {
      console.error('[Recording] Locator generation failed:', error);
      // Use minimal bundle
      bundle = {
        xpath: getSimpleXPath(element),
        tag: element.tagName.toLowerCase(),
        iframeChain: [],
        shadowHosts: []
      };
    }
    
    // Create step with available data
    const step = {
      stepNumber: 0, // Will be set by background
      event: event.type,
      label,
      bundle
    };
    
    // Send to background
    chrome.runtime.sendMessage({
      action: 'ADD_STEP',
      payload: { step }
    });
    
  } catch (error) {
    console.error('[Recording] Failed to capture step:', error);
    // Don't throw - keep recording active
  }
}
```

### 9.2 Error Reporting

Log errors for debugging:

```typescript
function reportError(context: string, error: Error, data?: any) {
  const errorReport = {
    context,
    message: error.message,
    stack: error.stack,
    data,
    timestamp: Date.now(),
    url: window.location.href,
    userAgent: navigator.userAgent
  };
  
  console.error('[Recording Error]', errorReport);
  
  // Send to background for storage
  chrome.runtime.sendMessage({
    action: 'LOG_ERROR',
    payload: errorReport
  });
}
```

---

## 10. Testing Approach

### 10.1 Unit Tests

Test individual components:

```typescript
describe('LabelDetector', () => {
  it('should detect ARIA label', () => {
    const element = document.createElement('button');
    element.setAttribute('aria-label', 'Submit Form');
    
    const label = LabelDetector.detect(element);
    expect(label).toBe('Submit Form');
  });
  
  it('should detect placeholder', () => {
    const element = document.createElement('input');
    element.setAttribute('placeholder', 'Enter email');
    
    const label = LabelDetector.detect(element);
    expect(label).toBe('Enter email');
  });
});

describe('LocatorGenerator', () => {
  it('should generate ID selector', () => {
    const element = document.createElement('button');
    element.id = 'submit-btn';
    
    const bundle = LocatorGenerator.generate(element);
    expect(bundle.id).toBe('submit-btn');
  });
});
```

### 10.2 Integration Tests

Test complete recording flow:

```typescript
describe('Recording Flow', () => {
  it('should capture click event', async () => {
    // Start recording
    await recordingEngine.start();
    
    // Simulate click
    const button = document.createElement('button');
    button.textContent = 'Click Me';
    document.body.appendChild(button);
    button.click();
    
    // Wait for step to be processed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify step was captured
    const steps = recordingEngine.getSteps();
    expect(steps).toHaveLength(1);
    expect(steps[0].event).toBe('click');
    expect(steps[0].label).toBe('Click Me');
  });
});
```

### 10.3 E2E Tests

Test on real web pages:

```typescript
test('Record login flow', async ({ page, context }) => {
  // Install extension
  const extensionId = await loadExtension(context);
  
  // Navigate to login page
  await page.goto('https://example.com/login');
  
  // Start recording via extension
  await startRecording(extensionId);
  
  // Perform user actions
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  
  // Stop recording
  const recording = await stopRecording(extensionId);
  
  // Verify steps
  expect(recording.steps).toHaveLength(3);
  expect(recording.steps[0].label).toBe('Email');
  expect(recording.steps[1].label).toBe('Password');
  expect(recording.steps[2].label).toBe('Submit');
});
```

---

## Summary

The Recording Engine provides:

✅ Complete architecture with 5 component layers  
✅ Clear component relationships and data flow  
✅ Integration points with background, popup, and storage  
✅ Configurable options for different recording scenarios  
✅ Well-defined lifecycle with state management  
✅ Performance optimizations (throttling, debouncing, memory limits)  
✅ Robust error handling with graceful degradation  
✅ Comprehensive testing strategy (unit, integration, E2E)

The Recording Engine is the foundation that enables accurate, reliable test automation by capturing user intent and converting it to structured, replayable steps.
