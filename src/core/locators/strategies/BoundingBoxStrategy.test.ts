/**
 * BoundingBoxStrategy Test Suite
 * @module core/locators/strategies/BoundingBoxStrategy.test
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  BoundingBoxStrategy,
  createBoundingBoxStrategy,
  getBoundingBoxStrategy,
  euclideanDistance,
  getCenter,
  boxDistance,
  sizesMatch,
  isElementVisible,
  isElementInteractable,
  findNearbyElements,
  spatialSearch,
  STRATEGY_NAME,
  STRATEGY_PRIORITY,
  BASE_CONFIDENCE,
  MAX_DISTANCE_THRESHOLD,
  SIZE_TOLERANCE,
  type BoundingBox,
} from './BoundingBoxStrategy';
import type { LocatorBundle } from '../../types/locator-bundle';
import type { LocatorContext } from './ILocatorStrategy';

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Creates a minimal LocatorBundle for testing
 */
function createTestBundle(overrides: Partial<LocatorBundle> = {}): LocatorBundle {
  return {
    tag: 'button',
    id: '',
    name: '',
    placeholder: '',
    aria: '',
    dataAttrs: {},
    text: 'Submit',
    css: '',
    xpath: '/html/body/button',
    classes: [],
    pageUrl: 'http://localhost',
    bounding: { x: 100, y: 100, width: 120, height: 40 },
    iframeChain: null,
    shadowHosts: null,
    ...overrides,
  };
}

/**
 * Creates a test context
 */
function createTestContext(doc?: Document): LocatorContext {
  return {
    document: doc || document,
  };
}

/**
 * Creates a positioned test element
 */
function createPositionedElement(
  tagName: string,
  x: number,
  y: number,
  width: number,
  height: number
): HTMLElement {
  const element = document.createElement(tagName);
  element.style.position = 'absolute';
  element.style.left = `${x}px`;
  element.style.top = `${y}px`;
  element.style.width = `${width}px`;
  element.style.height = `${height}px`;
  return element;
}

/**
 * Mock getBoundingClientRect for an element
 */
function mockBoundingRect(
  element: HTMLElement,
  rect: { x: number; y: number; width: number; height: number }
): void {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    top: rect.y,
    left: rect.x,
    right: rect.x + rect.width,
    bottom: rect.y + rect.height,
    toJSON: () => rect,
  } as DOMRect);
}

// ============================================================================
// HELPER FUNCTION TESTS
// ============================================================================

describe('euclideanDistance', () => {
  it('should return 0 for same point', () => {
    expect(euclideanDistance(0, 0, 0, 0)).toBe(0);
    expect(euclideanDistance(100, 100, 100, 100)).toBe(0);
  });
  
  it('should calculate horizontal distance', () => {
    expect(euclideanDistance(0, 0, 100, 0)).toBe(100);
  });
  
  it('should calculate vertical distance', () => {
    expect(euclideanDistance(0, 0, 0, 100)).toBe(100);
  });
  
  it('should calculate diagonal distance', () => {
    // 3-4-5 triangle
    expect(euclideanDistance(0, 0, 3, 4)).toBe(5);
  });
  
  it('should handle negative coordinates', () => {
    expect(euclideanDistance(-50, -50, 50, 50)).toBeCloseTo(141.42, 1);
  });
});

describe('getCenter', () => {
  it('should calculate center of box', () => {
    const box: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
    const center = getCenter(box);
    expect(center.x).toBe(50);
    expect(center.y).toBe(50);
  });
  
  it('should handle offset boxes', () => {
    const box: BoundingBox = { x: 100, y: 200, width: 50, height: 30 };
    const center = getCenter(box);
    expect(center.x).toBe(125);
    expect(center.y).toBe(215);
  });
});

describe('boxDistance', () => {
  it('should return 0 for overlapping boxes', () => {
    const box1: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
    const box2: BoundingBox = { x: 50, y: 50, width: 100, height: 100 };
    expect(boxDistance(box1, box2)).toBe(0);
  });
  
  it('should return 0 for adjacent boxes', () => {
    const box1: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
    const box2: BoundingBox = { x: 100, y: 0, width: 100, height: 100 };
    expect(boxDistance(box1, box2)).toBe(0);
  });
  
  it('should calculate horizontal gap', () => {
    const box1: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
    const box2: BoundingBox = { x: 150, y: 0, width: 100, height: 100 };
    expect(boxDistance(box1, box2)).toBe(50);
  });
  
  it('should calculate vertical gap', () => {
    const box1: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
    const box2: BoundingBox = { x: 0, y: 150, width: 100, height: 100 };
    expect(boxDistance(box1, box2)).toBe(50);
  });
  
  it('should calculate diagonal gap', () => {
    const box1: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
    const box2: BoundingBox = { x: 130, y: 140, width: 100, height: 100 };
    // Gap is 30 horizontal, 40 vertical = 50 diagonal (3-4-5)
    expect(boxDistance(box1, box2)).toBe(50);
  });
});

describe('sizesMatch', () => {
  it('should return true for identical sizes', () => {
    const box1: BoundingBox = { x: 0, y: 0, width: 100, height: 50 };
    const box2: BoundingBox = { x: 0, y: 0, width: 100, height: 50 };
    expect(sizesMatch(box1, box2)).toBe(true);
  });
  
  it('should return true for similar sizes within tolerance', () => {
    const box1: BoundingBox = { x: 0, y: 0, width: 100, height: 50 };
    const box2: BoundingBox = { x: 0, y: 0, width: 110, height: 55 };
    expect(sizesMatch(box1, box2, SIZE_TOLERANCE)).toBe(true);
  });
  
  it('should return false for very different sizes', () => {
    const box1: BoundingBox = { x: 0, y: 0, width: 100, height: 50 };
    const box2: BoundingBox = { x: 0, y: 0, width: 200, height: 100 };
    expect(sizesMatch(box1, box2, SIZE_TOLERANCE)).toBe(false);
  });
});

describe('isElementVisible', () => {
  let container: HTMLDivElement;
  
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });
  
  afterEach(() => {
    container.remove();
  });
  
  it('should return true for visible element', () => {
    const btn = createPositionedElement('button', 100, 100, 100, 40);
    container.appendChild(btn);
    mockBoundingRect(btn, { x: 100, y: 100, width: 100, height: 40 });
    
    expect(isElementVisible(btn)).toBe(true);
  });
  
  it('should return false for hidden element', () => {
    const btn = createPositionedElement('button', 100, 100, 100, 40);
    btn.style.display = 'none';
    container.appendChild(btn);
    
    expect(isElementVisible(btn)).toBe(false);
  });
  
  it('should return false for invisible element', () => {
    const btn = createPositionedElement('button', 100, 100, 100, 40);
    btn.style.visibility = 'hidden';
    container.appendChild(btn);
    
    expect(isElementVisible(btn)).toBe(false);
  });
  
  it('should return false for zero opacity element', () => {
    const btn = createPositionedElement('button', 100, 100, 100, 40);
    btn.style.opacity = '0';
    container.appendChild(btn);
    
    expect(isElementVisible(btn)).toBe(false);
  });
  
  it('should return false for tiny element', () => {
    const btn = createPositionedElement('button', 100, 100, 2, 2);
    container.appendChild(btn);
    mockBoundingRect(btn, { x: 100, y: 100, width: 2, height: 2 });
    
    expect(isElementVisible(btn)).toBe(false);
  });
});

describe('isElementInteractable', () => {
  it('should return true for normal element', () => {
    const btn = document.createElement('button');
    expect(isElementInteractable(btn)).toBe(true);
  });
  
  it('should return false for disabled element', () => {
    const btn = document.createElement('button') as HTMLButtonElement;
    btn.disabled = true;
    expect(isElementInteractable(btn)).toBe(false);
  });
});

describe('findNearbyElements', () => {
  let container: HTMLDivElement;
  
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });
  
  afterEach(() => {
    container.remove();
  });
  
  it('should find element at exact position', () => {
    const btn = createPositionedElement('button', 100, 100, 120, 40);
    container.appendChild(btn);
    mockBoundingRect(btn, { x: 100, y: 100, width: 120, height: 40 });
    
    const targetBox: BoundingBox = { x: 100, y: 100, width: 120, height: 40 };
    const candidates = findNearbyElements(targetBox, document);
    
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0].element).toBe(btn);
    expect(candidates[0].distance).toBe(0);
  });
  
  it('should find element nearby', () => {
    const btn = createPositionedElement('button', 150, 150, 120, 40);
    container.appendChild(btn);
    mockBoundingRect(btn, { x: 150, y: 150, width: 120, height: 40 });
    
    const targetBox: BoundingBox = { x: 100, y: 100, width: 120, height: 40 };
    const candidates = findNearbyElements(targetBox, document);
    
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0].element).toBe(btn);
  });
  
  it('should not find element too far away', () => {
    const btn = createPositionedElement('button', 500, 500, 120, 40);
    container.appendChild(btn);
    mockBoundingRect(btn, { x: 500, y: 500, width: 120, height: 40 });
    
    const targetBox: BoundingBox = { x: 100, y: 100, width: 120, height: 40 };
    const candidates = findNearbyElements(targetBox, document, undefined, 100);
    
    const found = candidates.find(c => c.element === btn);
    expect(found).toBeUndefined();
  });
  
  it('should sort by distance', () => {
    const btn1 = createPositionedElement('button', 120, 100, 60, 30);
    const btn2 = createPositionedElement('button', 200, 100, 60, 30);
    container.appendChild(btn1);
    container.appendChild(btn2);
    mockBoundingRect(btn1, { x: 120, y: 100, width: 60, height: 30 });
    mockBoundingRect(btn2, { x: 200, y: 100, width: 60, height: 30 });
    
    const targetBox: BoundingBox = { x: 100, y: 100, width: 60, height: 30 };
    const candidates = findNearbyElements(targetBox, document);
    
    expect(candidates.length).toBeGreaterThanOrEqual(2);
    // btn1 should be closer
    const btn1Index = candidates.findIndex(c => c.element === btn1);
    const btn2Index = candidates.findIndex(c => c.element === btn2);
    expect(btn1Index).toBeLessThan(btn2Index);
  });
  
  it('should filter by tag', () => {
    const btn = createPositionedElement('button', 100, 100, 60, 30);
    const div = createPositionedElement('div', 100, 100, 60, 30);
    container.appendChild(btn);
    container.appendChild(div);
    mockBoundingRect(btn, { x: 100, y: 100, width: 60, height: 30 });
    mockBoundingRect(div, { x: 100, y: 100, width: 60, height: 30 });
    
    const targetBox: BoundingBox = { x: 100, y: 100, width: 60, height: 30 };
    const candidates = findNearbyElements(targetBox, document, 'button');
    
    const hasButton = candidates.some(c => c.element === btn);
    const hasDiv = candidates.some(c => c.element === div);
    expect(hasButton).toBe(true);
    expect(hasDiv).toBe(false);
  });
});

describe('spatialSearch', () => {
  let container: HTMLDivElement;
  
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });
  
  afterEach(() => {
    container.remove();
  });
  
  it('should find best match', () => {
    const btn = createPositionedElement('button', 100, 100, 120, 40);
    container.appendChild(btn);
    mockBoundingRect(btn, { x: 100, y: 100, width: 120, height: 40 });
    
    const targetBox: BoundingBox = { x: 100, y: 100, width: 120, height: 40 };
    const result = spatialSearch(targetBox, document);
    
    expect(result.best).not.toBeNull();
    expect(result.best?.element).toBe(btn);
  });
  
  it('should detect ambiguous matches', () => {
    const btn1 = createPositionedElement('button', 100, 100, 60, 30);
    const btn2 = createPositionedElement('button', 105, 100, 60, 30);
    container.appendChild(btn1);
    container.appendChild(btn2);
    mockBoundingRect(btn1, { x: 100, y: 100, width: 60, height: 30 });
    mockBoundingRect(btn2, { x: 105, y: 100, width: 60, height: 30 });
    
    const targetBox: BoundingBox = { x: 100, y: 100, width: 60, height: 30 };
    const result = spatialSearch(targetBox, document);
    
    expect(result.isAmbiguous).toBe(true);
  });
  
  it('should return null when no matches', () => {
    const targetBox: BoundingBox = { x: 100, y: 100, width: 60, height: 30 };
    const result = spatialSearch(targetBox, document);
    
    expect(result.best).toBeNull();
    expect(result.candidates.length).toBe(0);
  });
});

// ============================================================================
// STRATEGY CLASS TESTS
// ============================================================================

describe('BoundingBoxStrategy', () => {
  let strategy: BoundingBoxStrategy;
  let container: HTMLDivElement;
  
  beforeEach(() => {
    strategy = createBoundingBoxStrategy();
    container = document.createElement('div');
    document.body.appendChild(container);
  });
  
  afterEach(() => {
    container.remove();
  });
  
  describe('constructor and properties', () => {
    it('should have correct name', () => {
      expect(strategy.name).toBe(STRATEGY_NAME);
    });
    
    it('should have correct priority', () => {
      expect(strategy.priority).toBe(STRATEGY_PRIORITY);
    });
    
    it('should have correct base confidence', () => {
      expect(strategy.baseConfidence).toBe(BASE_CONFIDENCE);
    });
    
    it('should have correct max distance', () => {
      expect(strategy.maxDistance).toBe(MAX_DISTANCE_THRESHOLD);
    });
  });
  
  describe('canHandle', () => {
    it('should return true for valid bounding box', () => {
      const bundle = createTestBundle({
        bounding: { x: 100, y: 100, width: 120, height: 40 },
      });
      expect(strategy.canHandle(bundle)).toBe(true);
    });
    
    it('should return false for missing bounding box', () => {
      const bundle = createTestBundle({ bounding: undefined });
      expect(strategy.canHandle(bundle)).toBe(false);
    });
    
    it('should return false for tiny dimensions', () => {
      const bundle = createTestBundle({
        bounding: { x: 100, y: 100, width: 2, height: 2 },
      });
      expect(strategy.canHandle(bundle)).toBe(false);
    });
    
    it('should return false for invalid coordinates', () => {
      const bundle = createTestBundle({
        bounding: { x: -2000, y: 100, width: 100, height: 40 },
      });
      expect(strategy.canHandle(bundle)).toBe(false);
    });
  });
  
  describe('find', () => {
    it('should find element at target position', () => {
      const btn = createPositionedElement('button', 100, 100, 120, 40);
      container.appendChild(btn);
      mockBoundingRect(btn, { x: 100, y: 100, width: 120, height: 40 });
      
      const bundle = createTestBundle({
        bounding: { x: 100, y: 100, width: 120, height: 40 },
        tag: 'button',
      });
      const context = createTestContext();
      
      const result = strategy.find(bundle, context);
      
      expect(result.element).toBe(btn);
      expect(result.confidence).toBeGreaterThan(BASE_CONFIDENCE);
      expect(result.metadata?.distance).toBe(0);
    });
    
    it('should find nearby element', () => {
      const btn = createPositionedElement('button', 150, 150, 120, 40);
      container.appendChild(btn);
      mockBoundingRect(btn, { x: 150, y: 150, width: 120, height: 40 });
      
      const bundle = createTestBundle({
        bounding: { x: 100, y: 100, width: 120, height: 40 },
        tag: 'button',
      });
      const context = createTestContext();
      
      const result = strategy.find(bundle, context);
      
      expect(result.element).toBe(btn);
      expect(result.metadata?.distance).toBeGreaterThan(0);
    });
    
    it('should return null for element too far', () => {
      const btn = createPositionedElement('button', 500, 500, 120, 40);
      container.appendChild(btn);
      mockBoundingRect(btn, { x: 500, y: 500, width: 120, height: 40 });
      
      const bundle = createTestBundle({
        bounding: { x: 100, y: 100, width: 120, height: 40 },
      });
      const context = createTestContext();
      
      const result = strategy.find(bundle, context);
      
      expect(result.element).toBeNull();
    });
    
    it('should return error for invalid bundle', () => {
      const bundle = createTestBundle({ bounding: undefined });
      const context = createTestContext();
      
      const result = strategy.find(bundle, context);
      
      expect(result.element).toBeNull();
      expect(result.error).toBeDefined();
    });
    
    it('should have higher confidence for closer elements', () => {
      const btn1 = createPositionedElement('button', 100, 100, 120, 40);
      const btn2 = createPositionedElement('button', 200, 200, 120, 40);
      container.appendChild(btn1);
      container.appendChild(btn2);
      mockBoundingRect(btn1, { x: 100, y: 100, width: 120, height: 40 });
      mockBoundingRect(btn2, { x: 200, y: 200, width: 120, height: 40 });
      
      const bundle1 = createTestBundle({
        bounding: { x: 100, y: 100, width: 120, height: 40 },
      });
      const bundle2 = createTestBundle({
        bounding: { x: 100, y: 100, width: 120, height: 40 },
      });
      
      // Test with btn1 only
      container.innerHTML = '';
      container.appendChild(btn1);
      const result1 = strategy.find(bundle1, createTestContext());
      
      // Test with btn2 only (further away)
      container.innerHTML = '';
      const btn2b = createPositionedElement('button', 200, 200, 120, 40);
      container.appendChild(btn2b);
      mockBoundingRect(btn2b, { x: 200, y: 200, width: 120, height: 40 });
      const result2 = strategy.find(bundle2, createTestContext());
      
      expect(result1.confidence).toBeGreaterThan(result2.confidence);
    });
    
    it('should report ambiguity for close candidates', () => {
      const btn1 = createPositionedElement('button', 100, 100, 60, 30);
      const btn2 = createPositionedElement('button', 105, 105, 60, 30);
      container.appendChild(btn1);
      container.appendChild(btn2);
      mockBoundingRect(btn1, { x: 100, y: 100, width: 60, height: 30 });
      mockBoundingRect(btn2, { x: 105, y: 105, width: 60, height: 30 });
      
      const bundle = createTestBundle({
        bounding: { x: 100, y: 100, width: 60, height: 30 },
      });
      const context = createTestContext();
      
      const result = strategy.find(bundle, context);
      
      expect(result.metadata?.isAmbiguous).toBe(true);
    });
  });
  
  describe('generateSelector', () => {
    it('should return JSON bounding box', () => {
      const btn = createPositionedElement('button', 100, 100, 120, 40);
      container.appendChild(btn);
      mockBoundingRect(btn, { x: 100, y: 100, width: 120, height: 40 });
      
      const selector = strategy.generateSelector(btn);
      
      expect(selector).not.toBeNull();
      const parsed = JSON.parse(selector!);
      expect(parsed.x).toBe(100);
      expect(parsed.y).toBe(100);
      expect(parsed.width).toBe(120);
      expect(parsed.height).toBe(40);
    });
    
    it('should return null for tiny element', () => {
      const btn = createPositionedElement('button', 100, 100, 2, 2);
      container.appendChild(btn);
      mockBoundingRect(btn, { x: 100, y: 100, width: 2, height: 2 });
      
      const selector = strategy.generateSelector(btn);
      
      expect(selector).toBeNull();
    });
  });
  
  describe('getBoundingBox', () => {
    it('should return bounding box', () => {
      const btn = createPositionedElement('button', 100, 100, 120, 40);
      container.appendChild(btn);
      mockBoundingRect(btn, { x: 100, y: 100, width: 120, height: 40 });
      
      const box = strategy.getBoundingBox(btn);
      
      expect(box.x).toBe(100);
      expect(box.y).toBe(100);
      expect(box.width).toBe(120);
      expect(box.height).toBe(40);
    });
  });
  
  describe('validate', () => {
    it('should return true for element at target', () => {
      const btn = createPositionedElement('button', 100, 100, 120, 40);
      container.appendChild(btn);
      mockBoundingRect(btn, { x: 100, y: 100, width: 120, height: 40 });
      
      const expectedBox: BoundingBox = { x: 100, y: 100, width: 120, height: 40 };
      expect(strategy.validate(btn, expectedBox)).toBe(true);
    });
    
    it('should return true for element within tolerance', () => {
      const btn = createPositionedElement('button', 150, 150, 120, 40);
      container.appendChild(btn);
      mockBoundingRect(btn, { x: 150, y: 150, width: 120, height: 40 });
      
      const expectedBox: BoundingBox = { x: 100, y: 100, width: 120, height: 40 };
      expect(strategy.validate(btn, expectedBox, 100)).toBe(true);
    });
    
    it('should return false for element outside tolerance', () => {
      const btn = createPositionedElement('button', 300, 300, 120, 40);
      container.appendChild(btn);
      mockBoundingRect(btn, { x: 300, y: 300, width: 120, height: 40 });
      
      const expectedBox: BoundingBox = { x: 100, y: 100, width: 120, height: 40 };
      expect(strategy.validate(btn, expectedBox, 50)).toBe(false);
    });
  });
  
  describe('getDistance', () => {
    it('should return distance to target', () => {
      const btn = createPositionedElement('button', 200, 200, 120, 40);
      container.appendChild(btn);
      mockBoundingRect(btn, { x: 200, y: 200, width: 120, height: 40 });
      
      const targetBox: BoundingBox = { x: 100, y: 100, width: 120, height: 40 };
      const distance = strategy.getDistance(btn, targetBox);
      
      expect(distance).toBeGreaterThan(0);
    });
    
    it('should return 0 for overlapping', () => {
      const btn = createPositionedElement('button', 100, 100, 120, 40);
      container.appendChild(btn);
      mockBoundingRect(btn, { x: 100, y: 100, width: 120, height: 40 });
      
      const targetBox: BoundingBox = { x: 100, y: 100, width: 120, height: 40 };
      const distance = strategy.getDistance(btn, targetBox);
      
      expect(distance).toBe(0);
    });
  });
  
  describe('findWithinRadius', () => {
    it('should find elements within radius', () => {
      const btn1 = createPositionedElement('button', 100, 100, 60, 30);
      const btn2 = createPositionedElement('button', 150, 100, 60, 30);
      const btn3 = createPositionedElement('button', 500, 500, 60, 30);
      container.appendChild(btn1);
      container.appendChild(btn2);
      container.appendChild(btn3);
      mockBoundingRect(btn1, { x: 100, y: 100, width: 60, height: 30 });
      mockBoundingRect(btn2, { x: 150, y: 100, width: 60, height: 30 });
      mockBoundingRect(btn3, { x: 500, y: 500, width: 60, height: 30 });
      
      const targetBox: BoundingBox = { x: 100, y: 100, width: 60, height: 30 };
      const elements = strategy.findWithinRadius(targetBox, document, 100);
      
      expect(elements).toContain(btn1);
      expect(elements).toContain(btn2);
      expect(elements).not.toContain(btn3);
    });
  });
});

// ============================================================================
// FACTORY TESTS
// ============================================================================

describe('getBoundingBoxStrategy (singleton)', () => {
  it('should return same instance', () => {
    const instance1 = getBoundingBoxStrategy();
    const instance2 = getBoundingBoxStrategy();
    expect(instance1).toBe(instance2);
  });
});

describe('createBoundingBoxStrategy (factory)', () => {
  it('should create new instance each time', () => {
    const instance1 = createBoundingBoxStrategy();
    const instance2 = createBoundingBoxStrategy();
    expect(instance1).not.toBe(instance2);
  });
});
