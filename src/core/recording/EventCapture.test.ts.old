/**
 * EventCapture Test Suite
 * @module core/recording/EventCapture.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  EventCapture,
  createEventCapture,
  capturedEventToStep,
  DEFAULT_CAPTURE_OPTIONS,
  CAPTURABLE_EVENTS,
  IGNORED_ELEMENTS,
  EXTENSION_MARKERS,
  SENSITIVE_INPUT_TYPES,
  type CapturedEvent,
  type ElementInfo,
} from './EventCapture';

// ============================================================================
// BROWSER GLOBALS MOCK
// ============================================================================

// Mock global objects
Object.defineProperty(global, 'window', {
  value: {
    location: { href: 'https://example.com' },
    innerWidth: 1920,
    innerHeight: 1080,
    scrollX: 0,
    scrollY: 0,
  },
  writable: true,
  configurable: true,
});

Object.defineProperty(global, 'navigator', {
  value: {
    userAgent: 'Mozilla/5.0 (Test)',
  },
  writable: true,
  configurable: true,
});

// Mock document with event listener tracking
const eventListeners: Map<string, Set<EventListener>> = new Map();

const mockDocument = {
  createElement: (tag: string) => {
    const element: any = {
      tagName: tag.toUpperCase(),
      nodeType: 1,
      parentNode: null,
      childNodes: [] as any[],
      children: [] as any[],
      classList: {
        contains: (cls: string) => {
          if (!element.className) return false;
          return element.className.split(' ').includes(cls);
        },
        add: (cls: string) => {
          if (!element.className) element.className = '';
          element.className = element.className ? `${element.className} ${cls}` : cls;
        },
      },
      setAttribute: (name: string, value: string) => {
        element[name] = value;
        if (!element.attributes) element.attributes = {};
        element.attributes[name] = value;
      },
      getAttribute: (name: string) => element[name] || null,
      hasAttribute: (name: string) => name in element,
      appendChild: (child: any) => {
        child.parentNode = element;
        element.childNodes.push(child);
        if (child.nodeType === 1) element.children.push(child);
        return child;
      },
      addEventListener: (type: string, listener: EventListener) => {
        if (!eventListeners.has(type)) {
          eventListeners.set(type, new Set());
        }
        eventListeners.get(type)!.add(listener);
      },
      removeEventListener: (type: string, listener: EventListener) => {
        eventListeners.get(type)?.delete(listener);
      },
      click: () => {
        const event = new MouseEvent('click', { bubbles: true });
        Object.defineProperty(event, 'target', { value: element, enumerable: true });
        Object.defineProperty(event, 'isTrusted', { value: true, enumerable: true });
        element.dispatchEvent(event);
      },
      dispatchEvent: (event: Event) => {
        Object.defineProperty(event, 'target', { value: element, enumerable: true });
        if (!Object.prototype.hasOwnProperty.call(event, 'isTrusted')) {
          Object.defineProperty(event, 'isTrusted', { value: true, enumerable: true });
        }
        
        // Bubble up
        let current: any = element;
        while (current) {
          const listeners = eventListeners.get(event.type);
          if (listeners) {
            listeners.forEach(listener => listener(event as any));
          }
          current = current.parentNode;
        }
        
        // Document listeners
        const docListeners = documentEventListeners.get(event.type);
        if (docListeners) {
          docListeners.forEach(listener => listener(event as any));
        }
        
        return true;
      },
      getBoundingClientRect: () => ({
        top: 0,
        left: 0,
        right: 100,
        bottom: 100,
        width: 100,
        height: 100,
      }),
    };
    return element;
  },
  body: null as any,
  documentElement: null as any,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  querySelectorAll: (selector: string) => [],
};

// Mock MutationObserver
global.MutationObserver = class MutationObserver {
  constructor(callback: MutationCallback) {}
  observe() {}
  disconnect() {}
  takeRecords() { return []; }
} as any;

// Mock Element constructor for instanceof checks
global.Element = class Element {
  nodeType = 1;
} as any;

global.HTMLElement = class HTMLElement extends (global.Element as any) {} as any;

global.Node = class Node {
  nodeType = 1;
  ELEMENT_NODE = 1;
  TEXT_NODE = 3;
  DOCUMENT_NODE = 9;
} as any;

global.CSS = {
  escape: (str: string) => str.replace(/[^a-zA-Z0-9_-]/g, '\\$&'),
} as any;

// Mock Event constructors
global.Event = class Event {
  type: string;
  bubbles: boolean;
  isTrusted: boolean = true;
  target: any;
  
  constructor(type: string, options?: any) {
    this.type = type;
    this.bubbles = options?.bubbles || false;
  }
  
  composedPath() {
    const path: any[] = [];
    let current = this.target;
    while (current) {
      path.push(current);
      current = current.parentNode;
    }
    return path;
  }
} as any;

global.MouseEvent = class MouseEvent extends (global.Event as any) {
  button: number = 0;
  clientX: number = 0;
  clientY: number = 0;
  pageX: number = 0;
  pageY: number = 0;
  offsetX: number = 0;
  offsetY: number = 0;
  ctrlKey: boolean = false;
  shiftKey: boolean = false;
  altKey: boolean = false;
  metaKey: boolean = false;
  
  constructor(type: string, options?: any) {
    super(type, options);
    Object.assign(this, options);
  }
} as any;

global.InputEvent = class InputEvent extends (global.Event as any) {
  data: string | null = null;
  isComposing: boolean = false;
  
  constructor(type: string, options?: any) {
    super(type, options);
    Object.assign(this, options);
  }
} as any;

global.KeyboardEvent = class KeyboardEvent extends (global.Event as any) {
  key: string = '';
  code: string = '';
  keyCode: number = 0;
  ctrlKey: boolean = false;
  shiftKey: boolean = false;
  altKey: boolean = false;
  metaKey: boolean = false;
  repeat: boolean = false;
  isComposing: boolean = false;
  
  constructor(type: string, options?: any) {
    super(type, options);
    Object.assign(this, options);
  }
} as any;

// Track document-level listeners separately
const documentEventListeners: Map<string, Set<EventListener>> = new Map();

mockDocument.addEventListener = ((type: string, listener: EventListener, options?: any) => {
  if (!documentEventListeners.has(type)) {
    documentEventListeners.set(type, new Set());
  }
  documentEventListeners.get(type)!.add(listener);
}) as any;

mockDocument.removeEventListener = ((type: string, listener: EventListener, options?: any) => {
  documentEventListeners.get(type)?.delete(listener);
}) as any;

// Create body and documentElement
mockDocument.body = mockDocument.createElement('body');
mockDocument.documentElement = mockDocument.createElement('html');
mockDocument.documentElement.appendChild(mockDocument.body);

// Set as global
Object.defineProperty(global, 'document', {
  value: mockDocument,
  writable: true,
  configurable: true,
});

// ============================================================================
// MOCK DOM SETUP
// ============================================================================

function createMockElement(
  tag: string,
  attrs: Record<string, string> = {},
  textContent?: string
): HTMLElement {
  const element = document.createElement(tag);
  
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'className') {
      element.className = value;
    } else {
      element.setAttribute(key, value);
    }
  }
  
  if (textContent) {
    element.textContent = textContent;
  }
  
  document.body.appendChild(element);
  return element;
}

function cleanupElements(): void {
  document.body.innerHTML = '';
}

// ============================================================================
// CONSTANT TESTS
// ============================================================================

describe('EventCapture constants', () => {
  it('should have capturable events defined', () => {
    expect(CAPTURABLE_EVENTS).toContain('click');
    expect(CAPTURABLE_EVENTS).toContain('input');
    expect(CAPTURABLE_EVENTS).toContain('keydown');
  });
  
  it('should have ignored elements defined', () => {
    expect(IGNORED_ELEMENTS).toContain('script');
    expect(IGNORED_ELEMENTS).toContain('style');
  });
  
  it('should have extension markers defined', () => {
    expect(EXTENSION_MARKERS).toContain('data-copilot-extension');
  });
  
  it('should have sensitive input types defined', () => {
    expect(SENSITIVE_INPUT_TYPES).toContain('password');
  });
  
  it('should have default options', () => {
    expect(DEFAULT_CAPTURE_OPTIONS.captureClicks).toBe(true);
    expect(DEFAULT_CAPTURE_OPTIONS.captureInput).toBe(true);
    expect(DEFAULT_CAPTURE_OPTIONS.sanitizeSensitive).toBe(true);
  });
});

// ============================================================================
// EVENT CAPTURE TESTS
// ============================================================================

describe('EventCapture', () => {
  let capture: EventCapture;
  let capturedEvents: CapturedEvent[];
  
  beforeEach(() => {
    capturedEvents = [];
    capture = createEventCapture({
      onCapture: (event) => capturedEvents.push(event),
    });
  });
  
  afterEach(() => {
    capture.stop();
    cleanupElements();
  });
  
  describe('lifecycle', () => {
    it('should start capturing', () => {
      capture.start();
      expect(capture.isCapturing).toBe(true);
    });
    
    it('should stop capturing', () => {
      capture.start();
      capture.stop();
      expect(capture.isCapturing).toBe(false);
    });
    
    it('should reset state', () => {
      capture.start();
      capture.reset();
      
      expect(capture.isCapturing).toBe(false);
      expect(capture.getStats().eventsProcessed).toBe(0);
    });
  });
  
  describe('click events', () => {
    it('should capture click events', () => {
      const button = createMockElement('button', { id: 'test-btn' }, 'Click me');
      
      capture.start();
      button.click();
      
      expect(capturedEvents.length).toBe(1);
      expect(capturedEvents[0].type).toBe('click');
      expect(capturedEvents[0].target.tagName).toBe('button');
    });
    
    it('should capture click coordinates', () => {
      const button = createMockElement('button', {}, 'Click');
      
      capture.start();
      
      const event = new MouseEvent('click', {
        bubbles: true,
        clientX: 100,
        clientY: 200,
      });
      button.dispatchEvent(event);
      
      expect(capturedEvents.length).toBe(1);
      const data = capturedEvents[0].data as { clientX: number; clientY: number };
      expect(data.clientX).toBe(100);
      expect(data.clientY).toBe(200);
    });
    
    it('should capture modifier keys', () => {
      const button = createMockElement('button', {}, 'Click');
      
      capture.start();
      
      const event = new MouseEvent('click', {
        bubbles: true,
        ctrlKey: true,
        shiftKey: true,
      });
      button.dispatchEvent(event);
      
      const data = capturedEvents[0].data as { ctrlKey: boolean; shiftKey: boolean };
      expect(data.ctrlKey).toBe(true);
      expect(data.shiftKey).toBe(true);
    });
  });
  
  describe('input events', () => {
    it('should capture input events', () => {
      const input = createMockElement('input', {
        type: 'text',
        id: 'test-input',
      }) as HTMLInputElement;
      
      capture.start();
      
      input.value = 'hello';
      input.dispatchEvent(new InputEvent('input', { bubbles: true }));
      
      expect(capturedEvents.length).toBe(1);
      expect(capturedEvents[0].type).toBe('input');
      
      const data = capturedEvents[0].data as { value: string };
      expect(data.value).toBe('hello');
    });
    
    it('should sanitize password inputs', () => {
      const input = createMockElement('input', {
        type: 'password',
      }) as HTMLInputElement;
      
      capture.start();
      
      input.value = 'secret123';
      input.dispatchEvent(new InputEvent('input', { bubbles: true }));
      
      const data = capturedEvents[0].data as { value: string };
      expect(data.value).toBe('********');
    });
    
    it('should truncate long values', () => {
      const input = createMockElement('input', {
        type: 'text',
      }) as HTMLInputElement;
      
      const longValue = 'a'.repeat(2000);
      
      capture.start();
      input.value = longValue;
      input.dispatchEvent(new InputEvent('input', { bubbles: true }));
      
      const data = capturedEvents[0].data as { value: string };
      expect(data.value.length).toBeLessThan(2000);
      expect(data.value.endsWith('...')).toBe(true);
    });
  });
  
  describe('keyboard events', () => {
    it('should capture keydown events', () => {
      const input = createMockElement('input', { type: 'text' });
      
      capture.start();
      
      const event = new KeyboardEvent('keydown', {
        bubbles: true,
        key: 'Enter',
        code: 'Enter',
      });
      input.dispatchEvent(event);
      
      expect(capturedEvents.length).toBe(1);
      expect(capturedEvents[0].type).toBe('keydown');
      
      const data = capturedEvents[0].data as { key: string };
      expect(data.key).toBe('Enter');
    });
    
    it('should capture keyboard modifiers', () => {
      const input = createMockElement('input', { type: 'text' });
      
      capture.start();
      
      const event = new KeyboardEvent('keydown', {
        bubbles: true,
        key: 'a',
        ctrlKey: true,
        metaKey: true,
      });
      input.dispatchEvent(event);
      
      const data = capturedEvents[0].data as { ctrlKey: boolean; metaKey: boolean };
      expect(data.ctrlKey).toBe(true);
      expect(data.metaKey).toBe(true);
    });
  });
  
  describe('element filtering', () => {
    it('should ignore script elements', () => {
      const script = createMockElement('script', {});
      
      capture.start();
      script.click();
      
      expect(capturedEvents.length).toBe(0);
    });
    
    it('should ignore extension UI elements', () => {
      const div = createMockElement('div', {
        'data-copilot-extension': 'true',
      });
      
      capture.start();
      div.click();
      
      expect(capturedEvents.length).toBe(0);
    });
    
    it('should ignore elements inside extension UI', () => {
      const container = createMockElement('div', {
        'data-copilot-extension': 'true',
      });
      const button = document.createElement('button');
      container.appendChild(button);
      
      capture.start();
      button.click();
      
      expect(capturedEvents.length).toBe(0);
    });
    
    it('should ignore untrusted events', () => {
      const button = createMockElement('button', {});
      
      capture.start();
      
      // Create untrusted event
      const event = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(event, 'isTrusted', { value: false });
      button.dispatchEvent(event);
      
      expect(capturedEvents.length).toBe(0);
    });
  });
  
  describe('element info extraction', () => {
    it('should extract element info', () => {
      const button = createMockElement('button', {
        id: 'my-btn',
        className: 'btn primary',
        'data-testid': 'submit-button',
        'aria-label': 'Submit form',
      }, 'Submit');
      
      capture.start();
      button.click();
      
      const info = capturedEvents[0].target;
      
      expect(info.tagName).toBe('button');
      expect(info.id).toBe('my-btn');
      expect(info.classNames).toContain('btn');
      expect(info.classNames).toContain('primary');
      expect(info.dataAttrs['data-testid']).toBe('submit-button');
      expect(info.aria['aria-label']).toBe('Submit form');
    });
    
    it('should generate XPath', () => {
      const div = createMockElement('div', {});
      const button = document.createElement('button');
      div.appendChild(button);
      
      capture.start();
      button.click();
      
      const xpath = capturedEvents[0].target.xpath;
      expect(xpath).toMatch(/\/.*button/);
    });
    
    it('should generate CSS selector', () => {
      const button = createMockElement('button', { id: 'unique-id' });
      
      capture.start();
      button.click();
      
      const selector = capturedEvents[0].target.cssSelector;
      expect(selector).toBe('#unique-id');
    });
    
    it('should prefer data-testid in CSS selector', () => {
      const button = createMockElement('button', {
        'data-testid': 'my-button',
      });
      
      capture.start();
      button.click();
      
      const selector = capturedEvents[0].target.cssSelector;
      expect(selector).toContain('data-testid');
    });
  });
  
  describe('custom filters', () => {
    it('should apply custom filter', () => {
      capture.addFilter((event, target) => {
        return target.tagName !== 'SPAN';
      });
      
      const button = createMockElement('button', {});
      const span = createMockElement('span', {});
      
      capture.start();
      button.click();
      span.click();
      
      expect(capturedEvents.length).toBe(1);
      expect(capturedEvents[0].target.tagName).toBe('button');
    });
    
    it('should remove custom filter', () => {
      const filter = () => false;
      capture.addFilter(filter);
      capture.removeFilter(filter);
      
      const button = createMockElement('button', {});
      
      capture.start();
      button.click();
      
      expect(capturedEvents.length).toBe(1);
    });
  });
  
  describe('options', () => {
    it('should respect captureClicks option', () => {
      capture.updateOptions({ captureClicks: false });
      
      const button = createMockElement('button', {});
      
      capture.start();
      button.click();
      
      expect(capturedEvents.length).toBe(0);
    });
    
    it('should respect captureInput option', () => {
      capture.updateOptions({ captureInput: false });
      
      const input = createMockElement('input', { type: 'text' }) as HTMLInputElement;
      
      capture.start();
      input.value = 'test';
      input.dispatchEvent(new InputEvent('input', { bubbles: true }));
      
      expect(capturedEvents.length).toBe(0);
    });
  });
  
  describe('statistics', () => {
    it('should track events processed', () => {
      const button = createMockElement('button', {});
      
      capture.start();
      button.click();
      button.click();
      
      const stats = capture.getStats();
      expect(stats.eventsProcessed).toBe(2);
    });
    
    it('should track events captured', () => {
      const button = createMockElement('button', {});
      
      capture.start();
      button.click();
      
      const stats = capture.getStats();
      expect(stats.eventsCaptured).toBe(1);
    });
    
    it('should track events filtered', () => {
      const script = createMockElement('script', {});
      
      capture.start();
      script.click();
      
      const stats = capture.getStats();
      expect(stats.eventsFiltered).toBe(1);
    });
  });
});

// ============================================================================
// CONVERSION TESTS
// ============================================================================

describe('capturedEventToStep', () => {
  it('should convert click event to step', () => {
    const captured: CapturedEvent = {
      type: 'click',
      target: {
        tagName: 'button',
        id: 'btn',
        classNames: ['primary'],
        xpath: '/html/body/button',
        cssSelector: '#btn',
        aria: {},
        dataAttrs: {},
        attributes: {},
        isVisible: true,
        isInViewport: true,
      },
      timestamp: Date.now(),
      data: {
        type: 'click',
        button: 0,
        clientX: 100,
        clientY: 200,
        pageX: 100,
        pageY: 200,
        offsetX: 10,
        offsetY: 10,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: false,
      },
      isTrusted: true,
    };
    
    const step = capturedEventToStep(captured);
    
    expect(step.type).toBe('click');
    expect(step.target?.tagName).toBe('button');
    expect(step.target?.xpath).toBe('/html/body/button');
  });
  
  it('should convert input event to step', () => {
    const captured: CapturedEvent = {
      type: 'input',
      target: {
        tagName: 'input',
        classNames: [],
        xpath: '/html/body/input',
        cssSelector: 'input',
        aria: {},
        dataAttrs: {},
        attributes: { type: 'text' },
        isVisible: true,
        isInViewport: true,
      },
      timestamp: Date.now(),
      data: {
        type: 'input',
        value: 'hello world',
        isComposing: false,
      },
      isTrusted: true,
    };
    
    const step = capturedEventToStep(captured);
    
    expect(step.type).toBe('input');
    expect(step.value).toBe('hello world');
  });
  
  it('should convert keyboard event to step', () => {
    const captured: CapturedEvent = {
      type: 'keydown',
      target: {
        tagName: 'input',
        classNames: [],
        xpath: '/html/body/input',
        cssSelector: 'input',
        aria: {},
        dataAttrs: {},
        attributes: {},
        isVisible: true,
        isInViewport: true,
      },
      timestamp: Date.now(),
      data: {
        type: 'keydown',
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: false,
        repeat: false,
        isComposing: false,
      },
      isTrusted: true,
    };
    
    const step = capturedEventToStep(captured);
    
    expect(step.type).toBe('keypress');
    expect(step.value).toBe('Enter');
  });
});

// ============================================================================
// XPATH AND CSS SELECTOR TESTS
// ============================================================================

describe('EventCapture selectors', () => {
  let capture: EventCapture;
  
  beforeEach(() => {
    capture = createEventCapture({
      onCapture: () => {},
    });
  });
  
  afterEach(() => {
    cleanupElements();
  });
  
  describe('generateXPath', () => {
    it('should generate valid XPath', () => {
      const div = createMockElement('div', {});
      const button = document.createElement('button');
      div.appendChild(button);
      
      const xpath = capture.generateXPath(button);
      
      expect(xpath).toMatch(/^\/.*button$/);
    });
    
    it('should handle multiple siblings', () => {
      const div = createMockElement('div', {});
      const span1 = document.createElement('span');
      const span2 = document.createElement('span');
      div.appendChild(span1);
      div.appendChild(span2);
      
      const xpath1 = capture.generateXPath(span1);
      const xpath2 = capture.generateXPath(span2);
      
      expect(xpath1).toContain('span[1]');
      expect(xpath2).toContain('span[2]');
    });
  });
  
  describe('generateCssSelector', () => {
    it('should prefer ID', () => {
      const button = createMockElement('button', { id: 'my-id' });
      
      const selector = capture.generateCssSelector(button);
      
      expect(selector).toBe('#my-id');
    });
    
    it('should use data-testid', () => {
      const button = createMockElement('button', {
        'data-testid': 'test-button',
      });
      
      const selector = capture.generateCssSelector(button);
      
      expect(selector).toContain('data-testid');
    });
    
    it('should use classes when no ID', () => {
      const button = createMockElement('button', {
        className: 'btn primary',
      });
      
      const selector = capture.generateCssSelector(button);
      
      expect(selector).toContain('btn');
    });
  });
});
