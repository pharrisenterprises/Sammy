# Context Enrichment System
**Project:** Chrome Extension Test Recorder  
**Document Version:** 1.0  
**Last Updated:** November 22, 2025  
**Status:** Complete Specification

## Table of Contents
1. Overview
2. Context Data Structure
3. Iframe Context Capture
4. Shadow DOM Context Capture
5. Scroll Position Tracking
6. Visibility Detection
7. Tab Context Management
8. Page State Capture
9. Timing and Sequence Metadata
10. Context Serialization

---

## 1. Overview

### 1.1 Purpose

The **Context Enrichment System** captures environmental metadata that enables accurate replay of recorded interactions. While locators identify *which* element to interact with, context tells the replay engine *how* to reach and interact with that element.

### 1.2 Key Context Types

| Context Type | Purpose | Example |
|--------------|---------|---------|
| **Iframe Context** | Navigate through nested frames | `['#app-frame', 'iframe[name="content"]']` |
| **Shadow DOM Context** | Access shadow root elements | `['my-app', 'my-dialog']` |
| **Scroll Position** | Scroll element into view | `{ x: 0, y: 450 }` |
| **Visibility State** | Wait for element visibility | `'visible'`, `'hidden'` |
| **Tab Context** | Manage multi-tab scenarios | `{ tabId: 123, windowId: 1 }` |
| **Page State** | URL, title, load state | `{ url: '...', loaded: true }` |
| **Timing** | Step sequencing | `{ timestamp: 1700000000, delay: 500 }` |

### 1.3 Design Goals

- ✅ **Complete Context** - Capture all data needed for replay
- ✅ **Minimal Overhead** - Efficient data collection
- ✅ **Serializable** - All data can be stored as JSON
- ✅ **Cross-Browser** - Standard APIs where possible

---

## 2. Context Data Structure

### 2.1 Complete StepContext Interface

```typescript
interface StepContext {
  // Frame context
  iframe: {
    isInIframe: boolean;
    depth: number;
    chain: string[];              // Selectors to reach this frame
    frameId?: number;             // Chrome frame ID
    frameSrc?: string;            // Frame source URL
  };
  
  // Shadow DOM context
  shadow: {
    isInShadowDOM: boolean;
    depth: number;
    hosts: string[];              // Selectors for shadow hosts
    isClosedShadow: boolean;      // Cannot access programmatically
  };
  
  // Scroll context
  scroll: {
    pageX: number;                // Document scroll position
    pageY: number;
    elementScroll?: {             // If inside scrollable container
      containerSelector: string;
      scrollTop: number;
      scrollLeft: number;
    };
    elementInView: boolean;       // Was element visible without scrolling
  };
  
  // Visibility context
  visibility: {
    state: 'visible' | 'hidden' | 'partially-visible' | 'offscreen';
    opacity: number;
    zIndex: number;
    overlapped: boolean;          // Covered by another element
    overlappingElement?: string;  // Selector of covering element
  };
  
  // Tab context
  tab: {
    tabId: number;
    windowId: number;
    active: boolean;
    url: string;
    title: string;
    incognito: boolean;
  };
  
  // Page state
  page: {
    url: string;
    title: string;
    readyState: 'loading' | 'interactive' | 'complete';
    hasPopups: boolean;
    popupCount: number;
    hasPendingRequests: boolean;
  };
  
  // Timing
  timing: {
    timestamp: number;            // When step was recorded
    timeSincePrevious: number;    // ms since last step
    pageLoadTime: number;         // ms since page load
    stepIndex: number;            // Order in recording
  };
  
  // Element state at time of interaction
  element: {
    tagName: string;
    boundingRect: DOMRect;
    computedStyle: {
      display: string;
      visibility: string;
      opacity: string;
      position: string;
      pointerEvents: string;
    };
    isEnabled: boolean;
    isEditable: boolean;
    isFocused: boolean;
  };
}
```

### 2.2 Context Builder

```typescript
class ContextBuilder {
  build(element: HTMLElement): StepContext {
    return {
      iframe: this.captureIframeContext(element),
      shadow: this.captureShadowContext(element),
      scroll: this.captureScrollContext(element),
      visibility: this.captureVisibilityContext(element),
      tab: this.captureTabContext(),
      page: this.capturePageContext(),
      timing: this.captureTimingContext(),
      element: this.captureElementState(element)
    };
  }
  
  // Individual capture methods implemented below...
}
```

---

## 3. Iframe Context Capture

### 3.1 Iframe Detection

```typescript
class IframeContextCapture {
  capture(element: HTMLElement): StepContext['iframe'] {
    const isInIframe = window !== window.top;
    
    if (!isInIframe) {
      return {
        isInIframe: false,
        depth: 0,
        chain: []
      };
    }
    
    const chain = this.buildIframeChain();
    
    return {
      isInIframe: true,
      depth: chain.length,
      chain: chain,
      frameId: this.getFrameId(),
      frameSrc: window.location.href
    };
  }
  
  private buildIframeChain(): string[] {
    const chain: string[] = [];
    let currentWindow: Window = window;
    
    while (currentWindow !== currentWindow.parent) {
      try {
        const parentWindow = currentWindow.parent;
        const iframes = parentWindow.document.querySelectorAll('iframe');
        
        for (const iframe of iframes) {
          if (iframe.contentWindow === currentWindow) {
            const selector = this.getIframeSelector(iframe);
            chain.unshift(selector);
            break;
          }
        }
        
        currentWindow = parentWindow;
      } catch (e) {
        // Cross-origin - cannot traverse further
        console.warn('[IframeContext] Cross-origin boundary reached');
        chain.unshift('__CROSS_ORIGIN__');
        break;
      }
    }
    
    return chain;
  }
  
  private getIframeSelector(iframe: HTMLIFrameElement): string {
    // Priority: id > name > src > position
    if (iframe.id) {
      return `#${CSS.escape(iframe.id)}`;
    }
    
    if (iframe.name) {
      return `iframe[name="${CSS.escape(iframe.name)}"]`;
    }
    
    const src = iframe.getAttribute('src');
    if (src && !src.startsWith('about:')) {
      // Use partial src match for reliability
      const urlPath = new URL(src, window.location.href).pathname;
      return `iframe[src*="${CSS.escape(urlPath)}"]`;
    }
    
    // Position-based fallback
    const parent = iframe.parentElement;
    if (parent) {
      const iframes = parent.querySelectorAll(':scope > iframe');
      const index = Array.from(iframes).indexOf(iframe);
      return `iframe:nth-of-type(${index + 1})`;
    }
    
    return 'iframe';
  }
  
  private getFrameId(): number | undefined {
    // Frame ID is assigned by Chrome - available via chrome.webNavigation
    // In content script, we don't have direct access
    // This would be populated by background script
    return undefined;
  }
}
```

### 3.2 Cross-Origin Iframe Handling

```typescript
class CrossOriginIframeHandler {
  detectCrossOrigin(): boolean {
    try {
      // Attempt to access parent document
      const parentDoc = window.parent.document;
      return false; // Same origin
    } catch (e) {
      return true; // Cross origin
    }
  }
  
  getCrossOriginInfo(): CrossOriginInfo {
    return {
      isCrossOrigin: this.detectCrossOrigin(),
      parentOrigin: this.getParentOrigin(),
      currentOrigin: window.location.origin,
      canCommunicate: this.canPostMessage()
    };
  }
  
  private getParentOrigin(): string | null {
    try {
      // This will fail for cross-origin
      return window.parent.location.origin;
    } catch {
      // Try to get from referrer
      if (document.referrer) {
        return new URL(document.referrer).origin;
      }
      return null;
    }
  }
  
  private canPostMessage(): boolean {
    // PostMessage always works, but we check if parent exists
    return window.parent !== window;
  }
}

interface CrossOriginInfo {
  isCrossOrigin: boolean;
  parentOrigin: string | null;
  currentOrigin: string;
  canCommunicate: boolean;
}
```

---

## 4. Shadow DOM Context Capture

### 4.1 Shadow Root Detection

```typescript
class ShadowContextCapture {
  capture(element: HTMLElement): StepContext['shadow'] {
    const hosts = this.getShadowHostChain(element);
    const isInShadowDOM = hosts.length > 0;
    
    return {
      isInShadowDOM,
      depth: hosts.length,
      hosts,
      isClosedShadow: this.hasClosedShadowRoot(element)
    };
  }
  
  private getShadowHostChain(element: HTMLElement): string[] {
    const hosts: string[] = [];
    let current: Node | null = element;
    
    while (current) {
      const root = current.getRootNode();
      
      if (root instanceof ShadowRoot) {
        const host = root.host as HTMLElement;
        const selector = this.getShadowHostSelector(host);
        hosts.unshift(selector);
        current = host;
      } else {
        // Reached document root
        break;
      }
    }
    
    return hosts;
  }
  
  private getShadowHostSelector(host: HTMLElement): string {
    // Custom elements (with hyphen) are often unique
    const tagName = host.tagName.toLowerCase();
    
    if (host.id) {
      return `#${CSS.escape(host.id)}`;
    }
    
    // Custom elements
    if (tagName.includes('-')) {
      // Check uniqueness
      const count = document.querySelectorAll(tagName).length;
      if (count === 1) {
        return tagName;
      }
      
      // Add context from parent
      const parent = host.parentElement;
      if (parent?.id) {
        return `#${CSS.escape(parent.id)} > ${tagName}`;
      }
      
      // Add class context
      const meaningfulClass = this.getMeaningfulClass(host);
      if (meaningfulClass) {
        return `${tagName}.${CSS.escape(meaningfulClass)}`;
      }
    }
    
    // Position-based fallback
    const parent = host.parentElement;
    if (parent) {
      const siblings = parent.querySelectorAll(`:scope > ${tagName}`);
      const index = Array.from(siblings).indexOf(host);
      return `${tagName}:nth-of-type(${index + 1})`;
    }
    
    return tagName;
  }
  
  private hasClosedShadowRoot(element: HTMLElement): boolean {
    // Walk up checking for closed shadow roots
    let current: Node | null = element;
    
    while (current) {
      const root = current.getRootNode();
      
      if (root instanceof ShadowRoot && root.mode === 'closed') {
        return true;
      }
      
      if (root instanceof ShadowRoot) {
        current = root.host;
      } else {
        break;
      }
    }
    
    return false;
  }
  
  private getMeaningfulClass(element: HTMLElement): string | null {
    const classes = Array.from(element.classList);
    
    // Filter out utility/generated classes
    const meaningful = classes.filter(cls => 
      !cls.match(/^[a-z]{6,}$/) &&    // Random hashes
      !cls.startsWith('_') &&          // CSS modules
      !cls.startsWith('css-') &&       // Emotion
      !cls.startsWith('sc-')           // Styled components
    );
    
    return meaningful[0] || null;
  }
}
```

### 4.2 Shadow DOM Path Resolution

```typescript
class ShadowPathResolver {
  /**
   * Resolve a shadow host chain to reach an element
   */
  resolve(hostSelectors: string[]): ShadowRoot | null {
    let currentRoot: Document | ShadowRoot = document;
    
    for (const selector of hostSelectors) {
      const host = currentRoot.querySelector(selector);
      
      if (!host) {
        console.error(`[ShadowPath] Host not found: ${selector}`);
        return null;
      }
      
      const shadowRoot = (host as HTMLElement).shadowRoot;
      
      if (!shadowRoot) {
        console.error(`[ShadowPath] No shadow root on: ${selector}`);
        return null;
      }
      
      currentRoot = shadowRoot;
    }
    
    return currentRoot instanceof ShadowRoot ? currentRoot : null;
  }
  
  /**
   * Find element within shadow DOM using full path
   */
  findElement(hostSelectors: string[], elementSelector: string): HTMLElement | null {
    if (hostSelectors.length === 0) {
      return document.querySelector(elementSelector);
    }
    
    const shadowRoot = this.resolve(hostSelectors);
    
    if (!shadowRoot) {
      return null;
    }
    
    return shadowRoot.querySelector(elementSelector);
  }
}
```

---

## 5. Scroll Position Tracking

### 5.1 Scroll Context Capture

```typescript
class ScrollContextCapture {
  capture(element: HTMLElement): StepContext['scroll'] {
    const pageScroll = this.getPageScroll();
    const elementScroll = this.getElementScrollContainer(element);
    const inView = this.isElementInView(element);
    
    return {
      pageX: pageScroll.x,
      pageY: pageScroll.y,
      elementScroll: elementScroll,
      elementInView: inView
    };
  }
  
  private getPageScroll(): { x: number; y: number } {
    return {
      x: window.scrollX || window.pageXOffset || document.documentElement.scrollLeft,
      y: window.scrollY || window.pageYOffset || document.documentElement.scrollTop
    };
  }
  
  private getElementScrollContainer(element: HTMLElement): StepContext['scroll']['elementScroll'] {
    // Find scrollable ancestor
    let parent = element.parentElement;
    
    while (parent && parent !== document.body) {
      const style = window.getComputedStyle(parent);
      const overflow = style.overflow + style.overflowX + style.overflowY;
      
      if (overflow.includes('scroll') || overflow.includes('auto')) {
        // Check if actually scrolled
        if (parent.scrollTop > 0 || parent.scrollLeft > 0) {
          return {
            containerSelector: this.getContainerSelector(parent),
            scrollTop: parent.scrollTop,
            scrollLeft: parent.scrollLeft
          };
        }
      }
      
      parent = parent.parentElement;
    }
    
    return undefined;
  }
  
  private getContainerSelector(container: HTMLElement): string {
    if (container.id) {
      return `#${CSS.escape(container.id)}`;
    }
    
    const className = container.className.split(' ')[0];
    if (className) {
      return `${container.tagName.toLowerCase()}.${CSS.escape(className)}`;
    }
    
    return container.tagName.toLowerCase();
  }
  
  private isElementInView(element: HTMLElement): boolean {
    const rect = element.getBoundingClientRect();
    
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= window.innerHeight &&
      rect.right <= window.innerWidth
    );
  }
}
```

### 5.2 Scroll Position Restoration

```typescript
class ScrollRestorer {
  async restore(context: StepContext['scroll']): Promise<void> {
    // Restore page scroll
    window.scrollTo({
      left: context.pageX,
      top: context.pageY,
      behavior: 'instant'
    });
    
    // Restore container scroll
    if (context.elementScroll) {
      const container = document.querySelector(context.elementScroll.containerSelector);
      
      if (container) {
        container.scrollTo({
          left: context.elementScroll.scrollLeft,
          top: context.elementScroll.scrollTop,
          behavior: 'instant'
        });
      }
    }
    
    // Small delay to let scroll settle
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  async scrollToElement(element: HTMLElement, options?: ScrollIntoViewOptions): Promise<void> {
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'center',
      ...options
    });
    
    // Wait for scroll animation
    await new Promise(resolve => setTimeout(resolve, 300));
  }
}
```

---

## 6. Visibility Detection

### 6.1 Visibility State Detection

```typescript
class VisibilityContextCapture {
  capture(element: HTMLElement): StepContext['visibility'] {
    const state = this.getVisibilityState(element);
    const computedStyle = window.getComputedStyle(element);
    const overlapping = this.checkOverlapping(element);
    
    return {
      state,
      opacity: parseFloat(computedStyle.opacity),
      zIndex: this.getZIndex(element),
      overlapped: overlapping.isOverlapped,
      overlappingElement: overlapping.overlappingSelector
    };
  }
  
  private getVisibilityState(element: HTMLElement): StepContext['visibility']['state'] {
    const style = window.getComputedStyle(element);
    
    // Check CSS visibility
    if (style.display === 'none') {
      return 'hidden';
    }
    
    if (style.visibility === 'hidden') {
      return 'hidden';
    }
    
    if (parseFloat(style.opacity) === 0) {
      return 'hidden';
    }
    
    // Check dimensions
    const rect = element.getBoundingClientRect();
    
    if (rect.width === 0 || rect.height === 0) {
      return 'hidden';
    }
    
    // Check if in viewport
    const inViewport = this.isInViewport(element);
    
    if (!inViewport) {
      return 'offscreen';
    }
    
    // Check partial visibility
    if (this.isPartiallyVisible(element)) {
      return 'partially-visible';
    }
    
    return 'visible';
  }
  
  private isInViewport(element: HTMLElement): boolean {
    const rect = element.getBoundingClientRect();
    
    return (
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < window.innerHeight &&
      rect.left < window.innerWidth
    );
  }
  
  private isPartiallyVisible(element: HTMLElement): boolean {
    const rect = element.getBoundingClientRect();
    
    // Check if any part is outside viewport
    return (
      rect.top < 0 ||
      rect.left < 0 ||
      rect.bottom > window.innerHeight ||
      rect.right > window.innerWidth
    );
  }
  
  private getZIndex(element: HTMLElement): number {
    const style = window.getComputedStyle(element);
    const zIndex = parseInt(style.zIndex, 10);
    
    return isNaN(zIndex) ? 0 : zIndex;
  }
  
  private checkOverlapping(element: HTMLElement): { isOverlapped: boolean; overlappingSelector?: string } {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Get element at center point
    const topElement = document.elementFromPoint(centerX, centerY);
    
    if (!topElement) {
      return { isOverlapped: false };
    }
    
    // Check if our element or a descendant
    if (element === topElement || element.contains(topElement)) {
      return { isOverlapped: false };
    }
    
    // Something else is on top
    return {
      isOverlapped: true,
      overlappingSelector: this.getOverlappingSelector(topElement as HTMLElement)
    };
  }
  
  private getOverlappingSelector(element: HTMLElement): string {
    if (element.id) {
      return `#${CSS.escape(element.id)}`;
    }
    
    const tagName = element.tagName.toLowerCase();
    const className = element.className?.split(' ')[0];
    
    if (className) {
      return `${tagName}.${CSS.escape(className)}`;
    }
    
    return tagName;
  }
}
```

### 6.2 Visibility Waiter

```typescript
class VisibilityWaiter {
  async waitForVisible(
    element: HTMLElement, 
    timeout: number = 10000
  ): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const capture = new VisibilityContextCapture();
      const visibility = capture.capture(element);
      
      if (visibility.state === 'visible' && !visibility.overlapped) {
        return true;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return false;
  }
  
  async waitForHidden(
    element: HTMLElement,
    timeout: number = 10000
  ): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const capture = new VisibilityContextCapture();
      const visibility = capture.capture(element);
      
      if (visibility.state === 'hidden') {
        return true;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return false;
  }
  
  async waitForOverlayGone(
    element: HTMLElement,
    timeout: number = 10000
  ): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const capture = new VisibilityContextCapture();
      const visibility = capture.capture(element);
      
      if (!visibility.overlapped) {
        return true;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return false;
  }
}
```

---

## 7. Tab Context Management

### 7.1 Tab Context Capture

```typescript
class TabContextCapture {
  async capture(): Promise<StepContext['tab']> {
    // In content script, request tab info from background
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: 'GET_TAB_INFO' },
        (response) => {
          if (response?.data) {
            resolve(response.data);
          } else {
            // Fallback with available info
            resolve({
              tabId: -1,
              windowId: -1,
              active: document.hasFocus(),
              url: window.location.href,
              title: document.title,
              incognito: false
            });
          }
        }
      );
    });
  }
}

// Background script handler
class TabInfoProvider {
  async getTabInfo(senderId: number): Promise<StepContext['tab']> {
    const tab = await chrome.tabs.get(senderId);
    
    return {
      tabId: tab.id!,
      windowId: tab.windowId,
      active: tab.active,
      url: tab.url || '',
      title: tab.title || '',
      incognito: tab.incognito
    };
  }
}
```

### 7.2 Multi-Tab Recording

```typescript
class MultiTabContextManager {
  private tabContexts: Map<number, TabRecordingContext> = new Map();
  
  startRecordingInTab(tabId: number): void {
    this.tabContexts.set(tabId, {
      tabId,
      startedAt: Date.now(),
      stepCount: 0,
      isActive: true
    });
  }
  
  recordStepInTab(tabId: number, step: RecordedStep): void {
    const context = this.tabContexts.get(tabId);
    
    if (context) {
      context.stepCount++;
      step.metadata = {
        ...step.metadata,
        tabId,
        tabStepIndex: context.stepCount
      };
    }
  }
  
  getTabOrder(): number[] {
    return Array.from(this.tabContexts.entries())
      .sort((a, b) => a[1].startedAt - b[1].startedAt)
      .map(([tabId]) => tabId);
  }
  
  handleTabClosed(tabId: number): void {
    const context = this.tabContexts.get(tabId);
    if (context) {
      context.isActive = false;
    }
  }
}

interface TabRecordingContext {
  tabId: number;
  startedAt: number;
  stepCount: number;
  isActive: boolean;
}
```

---

## 8. Page State Capture

### 8.1 Page Context Capture

```typescript
class PageContextCapture {
  capture(): StepContext['page'] {
    return {
      url: window.location.href,
      title: document.title,
      readyState: document.readyState as StepContext['page']['readyState'],
      hasPopups: this.detectPopups(),
      popupCount: this.countPopups(),
      hasPendingRequests: this.hasPendingRequests()
    };
  }
  
  private detectPopups(): boolean {
    // Check for common popup/modal patterns
    const popupSelectors = [
      '[role="dialog"]',
      '[role="alertdialog"]',
      '.modal',
      '.popup',
      '.overlay',
      '[data-modal]',
      '[aria-modal="true"]'
    ];
    
    for (const selector of popupSelectors) {
      const popup = document.querySelector(selector);
      if (popup && this.isVisible(popup as HTMLElement)) {
        return true;
      }
    }
    
    return false;
  }
  
  private countPopups(): number {
    const popupSelectors = [
      '[role="dialog"]',
      '[role="alertdialog"]',
      '.modal:not(.modal-backdrop)',
      '[aria-modal="true"]'
    ];
    
    let count = 0;
    
    for (const selector of popupSelectors) {
      const popups = document.querySelectorAll(selector);
      popups.forEach(popup => {
        if (this.isVisible(popup as HTMLElement)) {
          count++;
        }
      });
    }
    
    return count;
  }
  
  private hasPendingRequests(): boolean {
    // Check for loading indicators
    const loadingIndicators = [
      '.loading',
      '.spinner',
      '[aria-busy="true"]',
      '.skeleton',
      '[data-loading="true"]'
    ];
    
    for (const selector of loadingIndicators) {
      const indicator = document.querySelector(selector);
      if (indicator && this.isVisible(indicator as HTMLElement)) {
        return true;
      }
    }
    
    return false;
  }
  
  private isVisible(element: HTMLElement): boolean {
    const style = window.getComputedStyle(element);
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      parseFloat(style.opacity) > 0
    );
  }
}
```

### 8.2 Network Request Tracking

```typescript
class NetworkRequestTracker {
  private pendingRequests: Set<string> = new Set();
  private requestCount = 0;
  
  constructor() {
    this.interceptFetch();
    this.interceptXHR();
  }
  
  private interceptFetch(): void {
    const originalFetch = window.fetch;
    
    window.fetch = async (...args) => {
      const requestId = `fetch-${++this.requestCount}`;
      this.pendingRequests.add(requestId);
      
      try {
        const response = await originalFetch(...args);
        return response;
      } finally {
        this.pendingRequests.delete(requestId);
      }
    };
  }
  
  private interceptXHR(): void {
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    const tracker = this;
    
    XMLHttpRequest.prototype.open = function(...args: any[]) {
      (this as any).__requestId = `xhr-${++tracker.requestCount}`;
      return originalOpen.apply(this, args);
    };
    
    XMLHttpRequest.prototype.send = function(...args: any[]) {
      const requestId = (this as any).__requestId;
      tracker.pendingRequests.add(requestId);
      
      this.addEventListener('loadend', () => {
        tracker.pendingRequests.delete(requestId);
      });
      
      return originalSend.apply(this, args);
    };
  }
  
  hasPendingRequests(): boolean {
    return this.pendingRequests.size > 0;
  }
  
  getPendingCount(): number {
    return this.pendingRequests.size;
  }
  
  async waitForIdle(timeout: number = 5000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (!this.hasPendingRequests()) {
        // Wait a bit more to catch cascading requests
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (!this.hasPendingRequests()) {
          return true;
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    return false;
  }
}
```

---

## 9. Timing and Sequence Metadata

### 9.1 Timing Context Capture

```typescript
class TimingContextCapture {
  private lastStepTime: number = 0;
  private stepCounter: number = 0;
  private pageLoadTime: number;
  
  constructor() {
    this.pageLoadTime = performance.now();
  }
  
  capture(): StepContext['timing'] {
    const now = Date.now();
    const timeSincePrevious = this.lastStepTime > 0 
      ? now - this.lastStepTime 
      : 0;
    
    this.stepCounter++;
    this.lastStepTime = now;
    
    return {
      timestamp: now,
      timeSincePrevious,
      pageLoadTime: Math.round(performance.now() - this.pageLoadTime),
      stepIndex: this.stepCounter
    };
  }
  
  reset(): void {
    this.lastStepTime = 0;
    this.stepCounter = 0;
    this.pageLoadTime = performance.now();
  }
  
  getStepCount(): number {
    return this.stepCounter;
  }
}
```

### 9.2 Step Sequencing

```typescript
class StepSequencer {
  private steps: TimedStep[] = [];
  
  addStep(step: RecordedStep, context: StepContext): void {
    this.steps.push({
      step,
      context,
      recordedAt: Date.now()
    });
  }
  
  getTimingAnalysis(): TimingAnalysis {
    if (this.steps.length < 2) {
      return {
        averageDelay: 0,
        maxDelay: 0,
        minDelay: 0,
        totalDuration: 0
      };
    }
    
    const delays: number[] = [];
    
    for (let i = 1; i < this.steps.length; i++) {
      const delay = this.steps[i].recordedAt - this.steps[i - 1].recordedAt;
      delays.push(delay);
    }
    
    return {
      averageDelay: delays.reduce((a, b) => a + b, 0) / delays.length,
      maxDelay: Math.max(...delays),
      minDelay: Math.min(...delays),
      totalDuration: this.steps[this.steps.length - 1].recordedAt - this.steps[0].recordedAt
    };
  }
  
  getNormalizedSteps(): RecordedStep[] {
    // Normalize timing for consistent replay
    return this.steps.map((timedStep, index) => ({
      ...timedStep.step,
      stepNumber: index + 1,
      timing: {
        originalDelay: timedStep.context.timing.timeSincePrevious,
        normalizedDelay: this.getNormalizedDelay(timedStep.context.timing.timeSincePrevious)
      }
    }));
  }
  
  private getNormalizedDelay(originalDelay: number): number {
    // Cap very long delays (user was distracted)
    const maxDelay = 5000;
    
    // Ensure minimum delay between steps
    const minDelay = 100;
    
    return Math.max(minDelay, Math.min(maxDelay, originalDelay));
  }
}

interface TimedStep {
  step: RecordedStep;
  context: StepContext;
  recordedAt: number;
}

interface TimingAnalysis {
  averageDelay: number;
  maxDelay: number;
  minDelay: number;
  totalDuration: number;
}
```

---

## 10. Context Serialization

### 10.1 Context Serializer

```typescript
class ContextSerializer {
  serialize(context: StepContext): string {
    // Remove non-serializable data
    const serializable = this.makeSerializable(context);
    
    return JSON.stringify(serializable);
  }
  
  deserialize(json: string): StepContext {
    const parsed = JSON.parse(json);
    
    // Restore any special types
    return this.restoreTypes(parsed);
  }
  
  private makeSerializable(context: StepContext): any {
    return {
      ...context,
      element: {
        ...context.element,
        boundingRect: {
          top: context.element.boundingRect.top,
          left: context.element.boundingRect.left,
          right: context.element.boundingRect.right,
          bottom: context.element.boundingRect.bottom,
          width: context.element.boundingRect.width,
          height: context.element.boundingRect.height,
          x: context.element.boundingRect.x,
          y: context.element.boundingRect.y
        }
      }
    };
  }
  
  private restoreTypes(parsed: any): StepContext {
    // DOMRect is already plain object from serialization
    return parsed as StepContext;
  }
}
```

### 10.2 Element State Capture

```typescript
class ElementStateCapture {
  capture(element: HTMLElement): StepContext['element'] {
    const computedStyle = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    
    return {
      tagName: element.tagName.toLowerCase(),
      boundingRect: rect,
      computedStyle: {
        display: computedStyle.display,
        visibility: computedStyle.visibility,
        opacity: computedStyle.opacity,
        position: computedStyle.position,
        pointerEvents: computedStyle.pointerEvents
      },
      isEnabled: this.isEnabled(element),
      isEditable: this.isEditable(element),
      isFocused: document.activeElement === element
    };
  }
  
  private isEnabled(element: HTMLElement): boolean {
    // Check disabled attribute
    if ((element as HTMLInputElement).disabled) {
      return false;
    }
    
    // Check aria-disabled
    if (element.getAttribute('aria-disabled') === 'true') {
      return false;
    }
    
    // Check pointer-events
    const style = window.getComputedStyle(element);
    if (style.pointerEvents === 'none') {
      return false;
    }
    
    return true;
  }
  
  private isEditable(element: HTMLElement): boolean {
    // Check contenteditable
    if (element.isContentEditable) {
      return true;
    }
    
    // Check input/textarea
    const tagName = element.tagName.toLowerCase();
    if (['input', 'textarea'].includes(tagName)) {
      const input = element as HTMLInputElement;
      return !input.readOnly && !input.disabled;
    }
    
    return false;
  }
}
```

### 10.3 Complete Context Builder

```typescript
class CompleteContextBuilder {
  private iframeCapture = new IframeContextCapture();
  private shadowCapture = new ShadowContextCapture();
  private scrollCapture = new ScrollContextCapture();
  private visibilityCapture = new VisibilityContextCapture();
  private tabCapture = new TabContextCapture();
  private pageCapture = new PageContextCapture();
  private timingCapture = new TimingContextCapture();
  private elementCapture = new ElementStateCapture();
  
  async build(element: HTMLElement): Promise<StepContext> {
    const [tabContext] = await Promise.all([
      this.tabCapture.capture()
    ]);
    
    return {
      iframe: this.iframeCapture.capture(element),
      shadow: this.shadowCapture.capture(element),
      scroll: this.scrollCapture.capture(element),
      visibility: this.visibilityCapture.capture(element),
      tab: tabContext,
      page: this.pageCapture.capture(),
      timing: this.timingCapture.capture(),
      element: this.elementCapture.capture(element)
    };
  }
  
  reset(): void {
    this.timingCapture.reset();
  }
}

// Export singleton instance
export const contextBuilder = new CompleteContextBuilder();
```

---

## Summary

The Context Enrichment System provides:

✅ Complete StepContext structure with all context types  
✅ Iframe context capture with chain building and cross-origin handling  
✅ Shadow DOM context with host chain and closed root detection  
✅ Scroll position tracking including scrollable containers  
✅ Visibility detection with overlapping element checking  
✅ Tab context management for multi-tab recordings  
✅ Page state capture including popups and pending requests  
✅ Timing metadata for step sequencing and replay timing  
✅ Full serialization for storage and transmission

The context enrichment system ensures the replay engine has all the environmental data needed to accurately reproduce recorded interactions, even in complex scenarios with iframes, shadow DOM, and multi-tab workflows.
