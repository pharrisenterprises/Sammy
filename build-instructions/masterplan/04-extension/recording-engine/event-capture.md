# Event Capture Module
**Project:** Chrome Extension Test Recorder  
**Document Version:** 1.0  
**Last Updated:** November 22, 2025  
**Status:** Complete Specification

## Table of Contents
1. Overview
2. Supported Event Types
3. Event Listener Setup
4. Click Event Handling
5. Input Event Handling
6. Keyboard Event Handling
7. Navigation Event Handling
8. Event Filtering
9. Event Serialization
10. Debouncing and Throttling

---

## 1. Overview

### 1.1 Purpose

The **Event Capture Module** is responsible for intercepting user interactions on web pages and converting them into structured data for recording. It forms the input layer of the Recording Engine.

### 1.2 Key Responsibilities

1. **Listen for DOM events** - Click, input, keyboard, navigation
2. **Filter noise** - Ignore synthetic events, spam clicks, hidden elements
3. **Extract event data** - Target element, coordinates, values
4. **Serialize events** - Convert to structured JSON format
5. **Rate limit** - Debounce inputs, throttle rapid events

### 1.3 Design Principles

- ✅ **Capture Phase** - Intercept events before page handlers
- ✅ **Non-Blocking** - Async processing, no impact on page
- ✅ **Comprehensive** - Capture all user-initiated actions
- ✅ **Selective** - Filter out noise and irrelevant events

---

## 2. Supported Event Types

### 2.1 Event Categories

| Category | Events | Description |
|----------|--------|-------------|
| **Mouse** | click, dblclick, contextmenu | User clicks |
| **Input** | input, change, select | Form input changes |
| **Keyboard** | keydown, keyup | Key presses (optional) |
| **Focus** | focus, blur | Element focus changes |
| **Form** | submit, reset | Form submissions |
| **Navigation** | beforeunload, popstate | Page navigation |

### 2.2 Event Priority

**High Priority (Always Capture):**
- `click` - Primary interaction
- `input` - Text entry
- `change` - Dropdown/checkbox changes
- `submit` - Form submission

**Medium Priority (Capture for Context):**
- `focus` - Track active element
- `scroll` - Track viewport position

**Low Priority (Optional):**
- `keydown` - Individual key presses
- `mousemove` - Mouse position tracking
- `mouseenter/mouseleave` - Hover tracking

### 2.3 Event Type Enum

```typescript
enum CapturedEventType {
  // Mouse events
  CLICK = 'click',
  DOUBLE_CLICK = 'dblclick',
  RIGHT_CLICK = 'contextmenu',
  
  // Input events
  INPUT = 'input',
  CHANGE = 'change',
  SELECT = 'select',
  
  // Keyboard events
  KEY_DOWN = 'keydown',
  KEY_UP = 'keyup',
  
  // Focus events
  FOCUS = 'focus',
  BLUR = 'blur',
  
  // Form events
  SUBMIT = 'submit',
  RESET = 'reset',
  
  // Navigation events
  NAVIGATE = 'navigate',
  RELOAD = 'reload',
  BACK = 'back',
  FORWARD = 'forward'
}
```

---

## 3. Event Listener Setup

### 3.1 Listener Configuration

```typescript
interface EventListenerConfig {
  // Event types to capture
  events: CapturedEventType[];
  
  // Use capture phase (recommended)
  useCapture: boolean;
  
  // Passive listener (for performance)
  passive: boolean;
  
  // Throttle interval (ms)
  throttleMs: number;
  
  // Debounce interval for inputs (ms)
  debounceMs: number;
}

const DEFAULT_CONFIG: EventListenerConfig = {
  events: [
    CapturedEventType.CLICK,
    CapturedEventType.INPUT,
    CapturedEventType.CHANGE,
    CapturedEventType.SUBMIT
  ],
  useCapture: true,
  passive: true,
  throttleMs: 100,
  debounceMs: 500
};
```

### 3.2 EventCaptureManager Class

```typescript
class EventCaptureManager {
  private config: EventListenerConfig;
  private isCapturing: boolean = false;
  private listeners: Map<string, EventListener> = new Map();
  private throttler: EventThrottler;
  private debouncer: InputDebouncer;
  
  constructor(config: Partial<EventListenerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.throttler = new EventThrottler(this.config.throttleMs);
    this.debouncer = new InputDebouncer(this.config.debounceMs);
  }
  
  start() {
    if (this.isCapturing) {
      console.warn('[EventCapture] Already capturing');
      return;
    }
    
    this.attachListeners();
    this.isCapturing = true;
    console.log('[EventCapture] Started capturing events');
  }
  
  stop() {
    if (!this.isCapturing) {
      console.warn('[EventCapture] Not currently capturing');
      return;
    }
    
    this.detachListeners();
    this.isCapturing = false;
    console.log('[EventCapture] Stopped capturing events');
  }
  
  private attachListeners() {
    // Click events
    if (this.config.events.includes(CapturedEventType.CLICK)) {
      const clickListener = (e: MouseEvent) => this.handleClick(e);
      document.addEventListener('click', clickListener, {
        capture: this.config.useCapture,
        passive: this.config.passive
      });
      this.listeners.set('click', clickListener);
    }
    
    // Input events
    if (this.config.events.includes(CapturedEventType.INPUT)) {
      const inputListener = (e: Event) => this.handleInput(e as InputEvent);
      document.addEventListener('input', inputListener, {
        capture: this.config.useCapture,
        passive: this.config.passive
      });
      this.listeners.set('input', inputListener);
    }
    
    // Change events
    if (this.config.events.includes(CapturedEventType.CHANGE)) {
      const changeListener = (e: Event) => this.handleChange(e);
      document.addEventListener('change', changeListener, {
        capture: this.config.useCapture,
        passive: this.config.passive
      });
      this.listeners.set('change', changeListener);
    }
    
    // Submit events
    if (this.config.events.includes(CapturedEventType.SUBMIT)) {
      const submitListener = (e: Event) => this.handleSubmit(e);
      document.addEventListener('submit', submitListener, {
        capture: this.config.useCapture,
        passive: false // Need to potentially prevent default
      });
      this.listeners.set('submit', submitListener);
    }
    
    // Keyboard events (optional)
    if (this.config.events.includes(CapturedEventType.KEY_DOWN)) {
      const keydownListener = (e: KeyboardEvent) => this.handleKeydown(e);
      document.addEventListener('keydown', keydownListener, {
        capture: this.config.useCapture,
        passive: this.config.passive
      });
      this.listeners.set('keydown', keydownListener);
    }
  }
  
  private detachListeners() {
    this.listeners.forEach((listener, eventType) => {
      document.removeEventListener(eventType, listener, {
        capture: this.config.useCapture
      });
    });
    this.listeners.clear();
  }
  
  // Event handlers implemented below...
}
```

### 3.3 Attach to Shadow DOM

Extend listeners to shadow roots:

```typescript
class EventCaptureManager {
  // ... previous code
  
  private attachToShadowRoots() {
    const shadowRoots = this.findAllShadowRoots();
    
    shadowRoots.forEach(shadowRoot => {
      this.attachListenersToTarget(shadowRoot);
    });
    
    // Watch for new shadow roots
    this.observeShadowRoots();
  }
  
  private attachListenersToTarget(target: Document | ShadowRoot) {
    if (this.config.events.includes(CapturedEventType.CLICK)) {
      target.addEventListener('click', (e) => this.handleClick(e as MouseEvent), {
        capture: this.config.useCapture,
        passive: this.config.passive
      });
    }
    
    if (this.config.events.includes(CapturedEventType.INPUT)) {
      target.addEventListener('input', (e) => this.handleInput(e as InputEvent), {
        capture: this.config.useCapture,
        passive: this.config.passive
      });
    }
    
    // ... other event types
  }
  
  private findAllShadowRoots(root: Document | ShadowRoot = document): ShadowRoot[] {
    const shadowRoots: ShadowRoot[] = [];
    
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_ELEMENT
    );
    
    let node: Node | null;
    while (node = walker.nextNode()) {
      const element = node as Element;
      if (element.shadowRoot) {
        shadowRoots.push(element.shadowRoot);
        shadowRoots.push(...this.findAllShadowRoots(element.shadowRoot));
      }
    }
    
    return shadowRoots;
  }
  
  private observeShadowRoots() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            if (element.shadowRoot) {
              this.attachListenersToTarget(element.shadowRoot);
            }
          }
        });
      });
    });
    
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }
}
```

---

## 4. Click Event Handling

### 4.1 Click Handler Implementation

```typescript
class EventCaptureManager {
  // ... previous code
  
  private handleClick(event: MouseEvent) {
    // Skip if not capturing
    if (!this.isCapturing) return;
    
    // Throttle rapid clicks
    if (!this.throttler.shouldProcess('click')) {
      console.log('[EventCapture] Click throttled');
      return;
    }
    
    // Get target element
    const target = event.target as HTMLElement;
    
    // Filter out unwanted clicks
    if (!this.shouldCaptureClick(event, target)) {
      return;
    }
    
    // Extract click data
    const clickData = this.extractClickData(event, target);
    
    // Send to background
    this.emitEvent(clickData);
  }
  
  private shouldCaptureClick(event: MouseEvent, target: HTMLElement): boolean {
    // Filter synthetic events
    if (!event.isTrusted) {
      console.log('[EventCapture] Ignoring synthetic click');
      return false;
    }
    
    // Filter hidden elements
    if (!this.isElementVisible(target)) {
      console.log('[EventCapture] Ignoring click on hidden element');
      return false;
    }
    
    // Filter extension UI elements
    if (target.closest('[data-test-recorder-ui]')) {
      console.log('[EventCapture] Ignoring click on recorder UI');
      return false;
    }
    
    // Filter certain element types (optional)
    const ignoredTags = ['HTML', 'BODY'];
    if (ignoredTags.includes(target.tagName)) {
      console.log('[EventCapture] Ignoring click on', target.tagName);
      return false;
    }
    
    return true;
  }
  
  private extractClickData(event: MouseEvent, target: HTMLElement): CapturedEvent {
    return {
      type: CapturedEventType.CLICK,
      timestamp: Date.now(),
      target: {
        element: target,
        tagName: target.tagName.toLowerCase(),
        id: target.id || undefined,
        className: target.className || undefined,
        textContent: this.getVisibleText(target),
        attributes: this.getRelevantAttributes(target)
      },
      position: {
        clientX: event.clientX,
        clientY: event.clientY,
        pageX: event.pageX,
        pageY: event.pageY,
        offsetX: event.offsetX,
        offsetY: event.offsetY
      },
      modifiers: {
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey
      },
      button: event.button, // 0=left, 1=middle, 2=right
      page: {
        url: window.location.href,
        title: document.title
      }
    };
  }
  
  private isElementVisible(element: HTMLElement): boolean {
    // Check computed styles
    const style = window.getComputedStyle(element);
    
    if (style.display === 'none') return false;
    if (style.visibility === 'hidden') return false;
    if (style.opacity === '0') return false;
    
    // Check dimensions
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    
    return true;
  }
  
  private getVisibleText(element: HTMLElement): string {
    // Get text content, excluding hidden children
    const clone = element.cloneNode(true) as HTMLElement;
    
    // Remove hidden elements from clone
    clone.querySelectorAll('[style*="display: none"], [hidden]').forEach(el => {
      el.remove();
    });
    
    const text = clone.textContent?.trim() || '';
    
    // Limit length
    return text.substring(0, 100);
  }
  
  private getRelevantAttributes(element: HTMLElement): Record<string, string> {
    const attrs: Record<string, string> = {};
    
    const relevantAttrs = [
      'id', 'name', 'type', 'value', 'placeholder',
      'aria-label', 'aria-labelledby', 'aria-describedby',
      'data-testid', 'data-test', 'data-cy',
      'role', 'href', 'src', 'alt', 'title'
    ];
    
    relevantAttrs.forEach(attr => {
      const value = element.getAttribute(attr);
      if (value) {
        attrs[attr] = value;
      }
    });
    
    // Include all data-* attributes
    Array.from(element.attributes).forEach(attr => {
      if (attr.name.startsWith('data-') && !attrs[attr.name]) {
        attrs[attr.name] = attr.value;
      }
    });
    
    return attrs;
  }
}
```

### 4.2 Double Click Handling

```typescript
private handleDoubleClick(event: MouseEvent) {
  if (!this.isCapturing) return;
  
  const target = event.target as HTMLElement;
  
  if (!this.shouldCaptureClick(event, target)) {
    return;
  }
  
  const doubleClickData: CapturedEvent = {
    type: CapturedEventType.DOUBLE_CLICK,
    timestamp: Date.now(),
    target: {
      element: target,
      tagName: target.tagName.toLowerCase()
    },
    position: {
      clientX: event.clientX,
      clientY: event.clientY
    }
  };
  
  this.emitEvent(doubleClickData);
}
```

### 4.3 Right Click (Context Menu) Handling

```typescript
private handleContextMenu(event: MouseEvent) {
  if (!this.isCapturing) return;
  
  const target = event.target as HTMLElement;
  
  if (!event.isTrusted) return;
  
  const contextMenuData: CapturedEvent = {
    type: CapturedEventType.RIGHT_CLICK,
    timestamp: Date.now(),
    target: {
      element: target,
      tagName: target.tagName.toLowerCase()
    },
    position: {
      clientX: event.clientX,
      clientY: event.clientY
    }
  };
  
  this.emitEvent(contextMenuData);
}
```

---

## 5. Input Event Handling

### 5.1 Input Handler Implementation

```typescript
class EventCaptureManager {
  // ... previous code
  
  private handleInput(event: InputEvent) {
    if (!this.isCapturing) return;
    
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    
    // Filter synthetic events
    if (!event.isTrusted) {
      return;
    }
    
    // Filter hidden inputs
    if (!this.isElementVisible(target)) {
      return;
    }
    
    // Debounce input events (wait for user to finish typing)
    this.debouncer.debounce(target, () => {
      const inputData = this.extractInputData(target);
      this.emitEvent(inputData);
    });
  }
  
  private extractInputData(target: HTMLInputElement | HTMLTextAreaElement): CapturedEvent {
    const inputType = target.type || 'text';
    
    // Determine if value should be captured
    let value: string | undefined;
    
    if (this.shouldCaptureValue(target)) {
      value = target.value;
    }
    
    return {
      type: CapturedEventType.INPUT,
      timestamp: Date.now(),
      target: {
        element: target,
        tagName: target.tagName.toLowerCase(),
        id: target.id || undefined,
        name: target.name || undefined,
        inputType: inputType,
        attributes: this.getRelevantAttributes(target)
      },
      value: value,
      valueLength: target.value.length,
      page: {
        url: window.location.href,
        title: document.title
      }
    };
  }
  
  private shouldCaptureValue(target: HTMLInputElement | HTMLTextAreaElement): boolean {
    const inputType = target.type?.toLowerCase();
    
    // Never capture password values
    if (inputType === 'password') {
      return false;
    }
    
    // Don't capture values with sensitive names
    const sensitiveNames = ['password', 'pwd', 'secret', 'token', 'api_key', 'apikey'];
    const name = target.name?.toLowerCase() || '';
    
    if (sensitiveNames.some(s => name.includes(s))) {
      return false;
    }
    
    // Capture other values (they'll become variables during replay)
    return true;
  }
}
```

### 5.2 Input Type Handling

Handle different input types:

```typescript
private getInputValue(target: HTMLInputElement): any {
  const inputType = target.type?.toLowerCase();
  
  switch (inputType) {
    case 'checkbox':
      return target.checked;
    
    case 'radio':
      return target.checked ? target.value : null;
    
    case 'number':
    case 'range':
      return parseFloat(target.value);
    
    case 'date':
    case 'datetime-local':
    case 'time':
      return target.value; // ISO format string
    
    case 'file':
      // Don't capture file contents, just metadata
      return target.files ? Array.from(target.files).map(f => ({
        name: f.name,
        size: f.size,
        type: f.type
      })) : null;
    
    case 'password':
      // Return placeholder, not actual value
      return '***MASKED***';
    
    default:
      return target.value;
  }
}
```

### 5.3 ContentEditable Handling

Handle contenteditable elements:

```typescript
private handleContentEditableInput(event: InputEvent) {
  const target = event.target as HTMLElement;
  
  if (!target.isContentEditable) return;
  
  // Debounce contenteditable inputs
  this.debouncer.debounce(target, () => {
    const inputData: CapturedEvent = {
      type: CapturedEventType.INPUT,
      timestamp: Date.now(),
      target: {
        element: target,
        tagName: target.tagName.toLowerCase(),
        isContentEditable: true,
        attributes: this.getRelevantAttributes(target)
      },
      value: target.textContent || '',
      innerHTML: target.innerHTML,
      page: {
        url: window.location.href
      }
    };
    
    this.emitEvent(inputData);
  });
}
```

---

## 6. Keyboard Event Handling

### 6.1 Keyboard Handler Implementation

```typescript
class EventCaptureManager {
  // ... previous code
  
  private handleKeydown(event: KeyboardEvent) {
    if (!this.isCapturing) return;
    
    // Only capture specific keys of interest
    if (!this.shouldCaptureKeyPress(event)) {
      return;
    }
    
    const target = event.target as HTMLElement;
    
    const keyboardData: CapturedEvent = {
      type: CapturedEventType.KEY_DOWN,
      timestamp: Date.now(),
      target: {
        element: target,
        tagName: target.tagName.toLowerCase()
      },
      key: {
        key: event.key,
        code: event.code,
        keyCode: event.keyCode,
        modifiers: {
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
          metaKey: event.metaKey
        }
      },
      page: {
        url: window.location.href
      }
    };
    
    this.emitEvent(keyboardData);
  }
  
  private shouldCaptureKeyPress(event: KeyboardEvent): boolean {
    // Always capture Enter (form submission)
    if (event.key === 'Enter') {
      return true;
    }
    
    // Capture Tab (focus navigation)
    if (event.key === 'Tab') {
      return true;
    }
    
    // Capture Escape (close dialogs)
    if (event.key === 'Escape') {
      return true;
    }
    
    // Capture keyboard shortcuts (Ctrl/Cmd + key)
    if (event.ctrlKey || event.metaKey) {
      // Common shortcuts: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+Z, Ctrl+S
      const shortcutKeys = ['a', 'c', 'v', 'z', 's', 'x'];
      if (shortcutKeys.includes(event.key.toLowerCase())) {
        return true;
      }
    }
    
    // Capture arrow keys in certain contexts
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      const target = event.target as HTMLElement;
      
      // Arrow keys in selects, sliders, or with focus
      if (target.tagName === 'SELECT' || 
          target.getAttribute('role') === 'listbox' ||
          target.getAttribute('role') === 'slider') {
        return true;
      }
    }
    
    // Don't capture regular typing (handled by input events)
    return false;
  }
}
```

### 6.2 Special Key Combinations

Detect and label special key combinations:

```typescript
private describeKeyCombo(event: KeyboardEvent): string {
  const parts: string[] = [];
  
  if (event.ctrlKey) parts.push('Ctrl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  if (event.metaKey) parts.push('Cmd');
  
  // Add the key itself (unless it's a modifier)
  if (!['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) {
    parts.push(event.key);
  }
  
  return parts.join('+');
}

// Usage
// Ctrl+C → "Ctrl+c"
// Ctrl+Shift+T → "Ctrl+Shift+t"
// Enter → "Enter"
```

---

## 7. Navigation Event Handling

### 7.1 Navigation Detection

```typescript
class EventCaptureManager {
  // ... previous code
  
  private setupNavigationListeners() {
    // Before page unload
    window.addEventListener('beforeunload', () => {
      this.handleNavigation('unload');
    });
    
    // History API changes
    window.addEventListener('popstate', (event) => {
      this.handleNavigation('popstate', event.state);
    });
    
    // Hash changes
    window.addEventListener('hashchange', (event) => {
      this.handleHashChange(event);
    });
    
    // Intercept link clicks
    this.interceptLinkClicks();
    
    // Intercept history.pushState and replaceState
    this.interceptHistoryMethods();
  }
  
  private handleNavigation(type: string, state?: any) {
    if (!this.isCapturing) return;
    
    const navigationData: CapturedEvent = {
      type: CapturedEventType.NAVIGATE,
      timestamp: Date.now(),
      navigation: {
        type: type,
        fromUrl: window.location.href,
        toUrl: window.location.href, // Will be updated after navigation
        state: state
      },
      page: {
        url: window.location.href,
        title: document.title
      }
    };
    
    this.emitEvent(navigationData);
  }
  
  private handleHashChange(event: HashChangeEvent) {
    if (!this.isCapturing) return;
    
    const hashChangeData: CapturedEvent = {
      type: CapturedEventType.NAVIGATE,
      timestamp: Date.now(),
      navigation: {
        type: 'hashchange',
        fromUrl: event.oldURL,
        toUrl: event.newURL
      }
    };
    
    this.emitEvent(hashChangeData);
  }
}
```

### 7.2 Link Click Interception

Capture navigation via link clicks:

```typescript
private interceptLinkClicks() {
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const link = target.closest('a');
    
    if (!link) return;
    
    const href = link.getAttribute('href');
    if (!href) return;
    
    // Determine if this is a navigation
    const isNavigation = this.isNavigationLink(link);
    
    if (isNavigation && this.isCapturing) {
      const navigationData: CapturedEvent = {
        type: CapturedEventType.NAVIGATE,
        timestamp: Date.now(),
        navigation: {
          type: 'link_click',
          fromUrl: window.location.href,
          toUrl: this.resolveUrl(href),
          target: link.target || '_self'
        },
        target: {
          element: link,
          tagName: 'a',
          href: href,
          textContent: link.textContent?.trim()
        }
      };
      
      this.emitEvent(navigationData);
    }
  }, true);
}

private isNavigationLink(link: HTMLAnchorElement): boolean {
  const href = link.getAttribute('href');
  
  if (!href) return false;
  
  // Ignore javascript: links
  if (href.startsWith('javascript:')) return false;
  
  // Ignore anchor links on same page (handled by hashchange)
  if (href.startsWith('#') && !href.startsWith('#!')) return false;
  
  // Ignore mailto: and tel: links
  if (href.startsWith('mailto:') || href.startsWith('tel:')) return false;
  
  return true;
}

private resolveUrl(href: string): string {
  // Resolve relative URLs
  const link = document.createElement('a');
  link.href = href;
  return link.href;
}
```

### 7.3 History API Interception

Intercept programmatic navigation:

```typescript
private interceptHistoryMethods() {
  // Store original methods
  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);
  
  // Override pushState
  history.pushState = (...args) => {
    const result = originalPushState(...args);
    
    if (this.isCapturing) {
      this.handleHistoryChange('pushState', args[2] as string);
    }
    
    return result;
  };
  
  // Override replaceState
  history.replaceState = (...args) => {
    const result = originalReplaceState(...args);
    
    if (this.isCapturing) {
      this.handleHistoryChange('replaceState', args[2] as string);
    }
    
    return result;
  };
}

private handleHistoryChange(method: string, url: string | URL | null) {
  const navigationData: CapturedEvent = {
    type: CapturedEventType.NAVIGATE,
    timestamp: Date.now(),
    navigation: {
      type: method,
      fromUrl: window.location.href,
      toUrl: url?.toString() || window.location.href
    }
  };
  
  this.emitEvent(navigationData);
}
```

---

## 8. Event Filtering

### 8.1 Filter Configuration

```typescript
interface EventFilterConfig {
  // Ignore synthetic (programmatic) events
  ignoreSynthetic: boolean;
  
  // Ignore events on hidden elements
  ignoreHidden: boolean;
  
  // Ignore events on specific elements
  ignoreSelectors: string[];
  
  // Ignore events in specific URLs
  ignoreUrls: string[];
  
  // Minimum element size (filter tiny/invisible)
  minElementSize: number;
}

const DEFAULT_FILTER_CONFIG: EventFilterConfig = {
  ignoreSynthetic: true,
  ignoreHidden: true,
  ignoreSelectors: [
    '[data-test-recorder-ui]',      // Our UI
    '[data-no-record]',              // Developer opt-out
    '.no-record',                    // Developer opt-out
    '#intercom-container',           // Intercom widget
    '.drift-frame-controller',       // Drift widget
    '[data-reactroot] > script'      // React internals
  ],
  ignoreUrls: [
    'chrome-extension://',           // Extension pages
    'moz-extension://',              // Firefox extension pages
    'about:'                         // Browser pages
  ],
  minElementSize: 1
};
```

### 8.2 Event Filter Implementation

```typescript
class EventFilter {
  private config: EventFilterConfig;
  
  constructor(config: Partial<EventFilterConfig> = {}) {
    this.config = { ...DEFAULT_FILTER_CONFIG, ...config };
  }
  
  shouldCapture(event: Event, target: HTMLElement): boolean {
    // Check synthetic events
    if (this.config.ignoreSynthetic && !event.isTrusted) {
      console.log('[Filter] Rejected: synthetic event');
      return false;
    }
    
    // Check hidden elements
    if (this.config.ignoreHidden && !this.isVisible(target)) {
      console.log('[Filter] Rejected: hidden element');
      return false;
    }
    
    // Check ignored selectors
    for (const selector of this.config.ignoreSelectors) {
      if (target.matches(selector) || target.closest(selector)) {
        console.log('[Filter] Rejected: matches', selector);
        return false;
      }
    }
    
    // Check ignored URLs
    for (const urlPattern of this.config.ignoreUrls) {
      if (window.location.href.startsWith(urlPattern)) {
        console.log('[Filter] Rejected: URL matches', urlPattern);
        return false;
      }
    }
    
    // Check element size
    const rect = target.getBoundingClientRect();
    if (rect.width < this.config.minElementSize || 
        rect.height < this.config.minElementSize) {
      console.log('[Filter] Rejected: element too small');
      return false;
    }
    
    return true;
  }
  
  private isVisible(element: HTMLElement): boolean {
    const style = window.getComputedStyle(element);
    
    if (style.display === 'none') return false;
    if (style.visibility === 'hidden') return false;
    if (parseFloat(style.opacity) === 0) return false;
    
    // Check if element is in viewport (optional)
    const rect = element.getBoundingClientRect();
    const inViewport = (
      rect.top < window.innerHeight &&
      rect.bottom > 0 &&
      rect.left < window.innerWidth &&
      rect.right > 0
    );
    
    return inViewport || true; // Set to false to require viewport
  }
}
```

### 8.3 Synthetic Event Detection

Detect programmatically triggered events:

```typescript
function isSyntheticEvent(event: Event): boolean {
  // Primary check: isTrusted property
  if (!event.isTrusted) {
    return true;
  }
  
  // Additional heuristics for edge cases
  
  // Check if event was dispatched too quickly after page load
  const timeSinceLoad = Date.now() - performance.timing.domContentLoadedEventEnd;
  if (timeSinceLoad < 100 && event.type === 'click') {
    // Suspicious: click immediately after load
    console.log('[Filter] Suspicious: click too soon after load');
    // Don't reject, just flag
  }
  
  // Check for impossible mouse positions
  if (event instanceof MouseEvent) {
    if (event.clientX < 0 || event.clientY < 0) {
      return true; // Impossible position
    }
    
    if (event.clientX > window.innerWidth || 
        event.clientY > window.innerHeight) {
      return true; // Outside viewport
    }
  }
  
  return false;
}
```

---

## 9. Event Serialization

### 9.1 CapturedEvent Interface

```typescript
interface CapturedEvent {
  // Event identification
  type: CapturedEventType;
  timestamp: number;
  
  // Target element
  target: {
    element: HTMLElement;        // Reference (not serialized)
    tagName: string;
    id?: string;
    name?: string;
    className?: string;
    inputType?: string;          // For input elements
    textContent?: string;
    attributes: Record<string, string>;
    isContentEditable?: boolean;
  };
  
  // Position (for mouse events)
  position?: {
    clientX: number;
    clientY: number;
    pageX?: number;
    pageY?: number;
    offsetX?: number;
    offsetY?: number;
  };
  
  // Value (for input events)
  value?: any;
  valueLength?: number;
  innerHTML?: string;
  
  // Keyboard (for key events)
  key?: {
    key: string;
    code: string;
    keyCode: number;
    modifiers: {
      ctrlKey: boolean;
      shiftKey: boolean;
      altKey: boolean;
      metaKey: boolean;
    };
  };
  
  // Mouse button (for click events)
  button?: number;
  modifiers?: {
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    metaKey: boolean;
  };
  
  // Navigation
  navigation?: {
    type: string;
    fromUrl: string;
    toUrl: string;
    target?: string;
    state?: any;
  };
  
  // Page context
  page: {
    url: string;
    title?: string;
  };
}
```

### 9.2 Event Serializer

```typescript
class EventSerializer {
  serialize(event: CapturedEvent): SerializedEvent {
    // Create serializable version (no DOM references)
    const serialized: SerializedEvent = {
      type: event.type,
      timestamp: event.timestamp,
      target: this.serializeTarget(event.target),
      page: event.page
    };
    
    // Add optional fields
    if (event.position) {
      serialized.position = event.position;
    }
    
    if (event.value !== undefined) {
      serialized.value = this.serializeValue(event.value);
    }
    
    if (event.key) {
      serialized.key = event.key;
    }
    
    if (event.button !== undefined) {
      serialized.button = event.button;
    }
    
    if (event.modifiers) {
      serialized.modifiers = event.modifiers;
    }
    
    if (event.navigation) {
      serialized.navigation = event.navigation;
    }
    
    return serialized;
  }
  
  private serializeTarget(target: CapturedEvent['target']): any {
    // Exclude element reference (not serializable)
    const { element, ...rest } = target;
    return rest;
  }
  
  private serializeValue(value: any): any {
    // Handle special value types
    if (value instanceof File) {
      return {
        type: 'file',
        name: value.name,
        size: value.size,
        mimeType: value.type
      };
    }
    
    if (value instanceof FileList) {
      return Array.from(value).map(f => ({
        type: 'file',
        name: f.name,
        size: f.size,
        mimeType: f.type
      }));
    }
    
    // Handle Date objects
    if (value instanceof Date) {
      return value.toISOString();
    }
    
    // Return primitive values as-is
    return value;
  }
}

// Serialized event (can be stored/transmitted)
interface SerializedEvent {
  type: CapturedEventType;
  timestamp: number;
  target: {
    tagName: string;
    id?: string;
    name?: string;
    className?: string;
    inputType?: string;
    textContent?: string;
    attributes: Record<string, string>;
  };
  position?: {
    clientX: number;
    clientY: number;
  };
  value?: any;
  key?: {
    key: string;
    code: string;
    modifiers: Record<string, boolean>;
  };
  button?: number;
  modifiers?: Record<string, boolean>;
  navigation?: {
    type: string;
    fromUrl: string;
    toUrl: string;
  };
  page: {
    url: string;
    title?: string;
  };
}
```

---

## 10. Debouncing and Throttling

### 10.1 Event Throttler

Prevent capturing too many rapid events:

```typescript
class EventThrottler {
  private lastEventTimes: Map<string, number> = new Map();
  private minInterval: number;
  
  constructor(minInterval: number = 100) {
    this.minInterval = minInterval;
  }
  
  shouldProcess(eventType: string): boolean {
    const now = Date.now();
    const lastTime = this.lastEventTimes.get(eventType) || 0;
    
    if (now - lastTime < this.minInterval) {
      return false;
    }
    
    this.lastEventTimes.set(eventType, now);
    return true;
  }
  
  reset(eventType?: string) {
    if (eventType) {
      this.lastEventTimes.delete(eventType);
    } else {
      this.lastEventTimes.clear();
    }
  }
}
```

### 10.2 Input Debouncer

Wait for user to finish typing:

```typescript
class InputDebouncer {
  private timers: Map<HTMLElement, NodeJS.Timeout> = new Map();
  private delay: number;
  
  constructor(delay: number = 500) {
    this.delay = delay;
  }
  
  debounce(element: HTMLElement, callback: () => void) {
    // Clear existing timer for this element
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
  
  flush(element?: HTMLElement) {
    if (element) {
      const timer = this.timers.get(element);
      if (timer) {
        clearTimeout(timer);
        this.timers.delete(element);
      }
    } else {
      this.timers.forEach(timer => clearTimeout(timer));
      this.timers.clear();
    }
  }
  
  hasPending(element: HTMLElement): boolean {
    return this.timers.has(element);
  }
}
```

### 10.3 Combined Usage

```typescript
class EventCaptureManager {
  private throttler: EventThrottler;
  private debouncer: InputDebouncer;
  
  constructor() {
    this.throttler = new EventThrottler(100);  // 100ms between events
    this.debouncer = new InputDebouncer(500);  // 500ms after typing stops
  }
  
  private handleClick(event: MouseEvent) {
    // Throttle clicks
    if (!this.throttler.shouldProcess('click')) {
      console.log('[EventCapture] Click throttled');
      return;
    }
    
    // Process click...
  }
  
  private handleInput(event: InputEvent) {
    const target = event.target as HTMLElement;
    
    // Debounce input events
    this.debouncer.debounce(target, () => {
      // Only fires after user stops typing for 500ms
      const inputData = this.extractInputData(target);
      this.emitEvent(inputData);
    });
  }
  
  // Flush pending inputs when recording stops
  stop() {
    this.debouncer.flush();
    this.detachListeners();
    this.isCapturing = false;
  }
}
```

### 10.4 Intelligent Input Batching

Batch rapid input changes into single events:

```typescript
class InputBatcher {
  private batches: Map<HTMLElement, InputBatch> = new Map();
  private flushDelay: number = 500;
  
  addInput(element: HTMLElement, value: string) {
    let batch = this.batches.get(element);
    
    if (!batch) {
      batch = {
        element,
        startValue: value,
        endValue: value,
        startTime: Date.now(),
        endTime: Date.now(),
        inputCount: 1
      };
      this.batches.set(element, batch);
      
      // Schedule flush
      setTimeout(() => this.flushBatch(element), this.flushDelay);
    } else {
      batch.endValue = value;
      batch.endTime = Date.now();
      batch.inputCount++;
    }
  }
  
  private flushBatch(element: HTMLElement) {
    const batch = this.batches.get(element);
    
    if (!batch) return;
    
    // Check if there have been new inputs
    const timeSinceLastInput = Date.now() - batch.endTime;
    
    if (timeSinceLastInput < this.flushDelay) {
      // More inputs came in, reschedule flush
      setTimeout(() => this.flushBatch(element), this.flushDelay - timeSinceLastInput);
      return;
    }
    
    // Flush the batch
    console.log('[InputBatcher] Flushing batch:', {
      inputCount: batch.inputCount,
      duration: batch.endTime - batch.startTime,
      finalValue: batch.endValue
    });
    
    // Emit single event with final value
    this.emitBatchedInput(batch);
    this.batches.delete(element);
  }
  
  private emitBatchedInput(batch: InputBatch) {
    // Send to background as single input event
    chrome.runtime.sendMessage({
      action: 'ADD_STEP',
      payload: {
        step: {
          event: 'input',
          value: batch.endValue,
          // ... other fields
        }
      }
    });
  }
}

interface InputBatch {
  element: HTMLElement;
  startValue: string;
  endValue: string;
  startTime: number;
  endTime: number;
  inputCount: number;
}
```

---

## Summary

The Event Capture Module provides:

✅ Comprehensive event support (click, input, keyboard, navigation)  
✅ Capture phase listeners for reliable interception  
✅ Shadow DOM support with recursive listener attachment  
✅ Click handling with visibility and synthetic event filtering  
✅ Input handling with type-specific value extraction  
✅ Keyboard handling for special keys and shortcuts  
✅ Navigation tracking via links, history API, and hash changes  
✅ Robust filtering to ignore noise and irrelevant events  
✅ Event serialization for storage and transmission  
✅ Debouncing/throttling for performance optimization

The event capture module ensures accurate, efficient capture of user interactions across all page contexts.
