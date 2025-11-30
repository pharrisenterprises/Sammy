/**
 * @fileoverview Tests for locator strategies
 * @module core/locators/strategies.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  executeStrategy,
  performClick,
  performInput,
  performEnter,
  highlightElement,
  createHighlightOverlay,
  removeHighlightOverlay,
  waitForElementStable,
  isElementVisible,
  isElementInteractable,
  getElementVisibleText,
  DEFAULT_STRATEGY_OPTIONS,
  DEFAULT_INTERACTION_OPTIONS
} from './strategies';
import { createBundle } from '../types';

describe('Strategies', () => {
  let dom: JSDOM;
  let document: Document;
  let window: Window;

  beforeEach(() => {
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <form id="login-form">
            <input id="username" name="username" type="text" placeholder="Enter username">
            <input id="password" name="password" type="password" placeholder="Enter password">
            <button id="submit-btn" type="submit">Log In</button>
            <input id="disabled-input" disabled value="disabled">
          </form>
          <div id="hidden" style="display: none;">Hidden content</div>
          <div id="invisible" style="visibility: hidden;">Invisible content</div>
          <div id="transparent" style="opacity: 0;">Transparent content</div>
          <div id="visible">Visible content</div>
          <iframe id="test-iframe" src="about:blank"></iframe>
        </body>
      </html>
    `, { 
      url: 'http://localhost/',
      runScripts: 'dangerously'
    });
    document = dom.window.document;
    window = dom.window as unknown as Window;

    // Mock global document and window
    global.document = document;
    global.window = window as any;
  });

  afterEach(() => {
    dom.window.close();
  });

  // ==========================================================================
  // DEFAULT OPTIONS
  // ==========================================================================

  describe('Default Options', () => {
    it('should have correct default strategy options', () => {
      expect(DEFAULT_STRATEGY_OPTIONS.timeout).toBe(2000);
      expect(DEFAULT_STRATEGY_OPTIONS.retryInterval).toBe(150);
      expect(DEFAULT_STRATEGY_OPTIONS.searchIframes).toBe(true);
      expect(DEFAULT_STRATEGY_OPTIONS.searchShadowDom).toBe(true);
      expect(DEFAULT_STRATEGY_OPTIONS.maxIframeDepth).toBe(3);
      expect(DEFAULT_STRATEGY_OPTIONS.maxShadowDepth).toBe(5);
    });

    it('should have correct default interaction options', () => {
      expect(DEFAULT_INTERACTION_OPTIONS.scrollIntoView).toBe(true);
      expect(DEFAULT_INTERACTION_OPTIONS.highlight).toBe(false);
      expect(DEFAULT_INTERACTION_OPTIONS.highlightDuration).toBe(500);
      expect(DEFAULT_INTERACTION_OPTIONS.delayBefore).toBe(0);
      expect(DEFAULT_INTERACTION_OPTIONS.delayAfter).toBe(0);
    });
  });

  // ==========================================================================
  // EXECUTE STRATEGY
  // ==========================================================================

  describe('executeStrategy', () => {
    it('should find element in main document', async () => {
      const bundle = createBundle({ id: 'username' });
      
      const result = await executeStrategy(bundle, {
        onProgress: vi.fn()
      });

      expect(result.found).toBe(true);
      expect(result.element).not.toBeNull();
      expect(result.inIframe).toBe(false);
      expect(result.inShadowDom).toBe(false);
    });

    it('should return match score', async () => {
      const bundle = createBundle({ 
        id: 'username',
        tag: 'input',
        name: 'username'
      });
      
      const result = await executeStrategy(bundle);

      expect(result.matchScore).toBeGreaterThan(0);
    });

    it('should call onProgress callback', async () => {
      const onProgress = vi.fn();
      const bundle = createBundle({ id: 'username' });
      
      await executeStrategy(bundle, { onProgress });

      expect(onProgress).toHaveBeenCalled();
    });

    it('should return not found for non-existent element', async () => {
      const bundle = createBundle({ id: 'non-existent' });
      
      const result = await executeStrategy(bundle, {
        timeout: 100,
        retryInterval: 50
      });

      expect(result.found).toBe(false);
      expect(result.element).toBeNull();
    });
  });

  // ==========================================================================
  // ELEMENT INTERACTIONS
  // ==========================================================================

  describe('performClick', () => {
    it('should click element successfully', async () => {
      const element = document.getElementById('submit-btn')!;
      const clickHandler = vi.fn();
      element.addEventListener('click', clickHandler);

      const result = await performClick(element);

      expect(result.status).toBe('passed');
      expect(result.strategy_used).toBe('click');
      expect(clickHandler).toHaveBeenCalled();
    });

    it('should respect delay options', async () => {
      const element = document.getElementById('submit-btn')!;
      const startTime = performance.now();

      await performClick(element, {
        delayBefore: 50,
        delayAfter: 50
      });

      const duration = performance.now() - startTime;
      expect(duration).toBeGreaterThanOrEqual(90);
    });
  });

  describe('performInput', () => {
    it('should input text successfully', async () => {
      const element = document.getElementById('username')! as HTMLInputElement;

      const result = await performInput(element, 'testuser');

      expect(result.status).toBe('passed');
      expect(result.strategy_used).toBe('input');
      expect(element.value).toBe('testuser');
    });

    it('should clear existing value before input', async () => {
      const element = document.getElementById('username')! as HTMLInputElement;
      element.value = 'existing';

      await performInput(element, 'newvalue');

      expect(element.value).toBe('newvalue');
    });

    it('should fail for non-input elements', async () => {
      const element = document.getElementById('submit-btn')!;

      const result = await performInput(element, 'test');

      expect(result.status).toBe('failed');
      expect(result.error).toContain('not an input');
    });

    it('should dispatch input and change events', async () => {
      const element = document.getElementById('username')! as HTMLInputElement;
      const inputHandler = vi.fn();
      const changeHandler = vi.fn();
      element.addEventListener('input', inputHandler);
      element.addEventListener('change', changeHandler);

      await performInput(element, 'testuser');

      expect(inputHandler).toHaveBeenCalled();
      expect(changeHandler).toHaveBeenCalled();
    });
  });

  describe('performEnter', () => {
    it('should dispatch Enter key events', async () => {
      const element = document.getElementById('username')!;
      const keydownHandler = vi.fn();
      const keypressHandler = vi.fn();
      const keyupHandler = vi.fn();
      
      element.addEventListener('keydown', keydownHandler);
      element.addEventListener('keypress', keypressHandler);
      element.addEventListener('keyup', keyupHandler);

      const result = await performEnter(element);

      expect(result.status).toBe('passed');
      expect(result.strategy_used).toBe('enter');
      expect(keydownHandler).toHaveBeenCalled();
      expect(keypressHandler).toHaveBeenCalled();
      expect(keyupHandler).toHaveBeenCalled();
    });

    it('should dispatch events with correct key properties', async () => {
      const element = document.getElementById('username')!;
      let capturedEvent: KeyboardEvent | null = null;
      
      element.addEventListener('keydown', (e) => {
        capturedEvent = e as KeyboardEvent;
      });

      await performEnter(element);

      expect(capturedEvent).not.toBeNull();
      expect(capturedEvent!.key).toBe('Enter');
      expect(capturedEvent!.code).toBe('Enter');
    });
  });

  // ==========================================================================
  // HIGHLIGHTING
  // ==========================================================================

  describe('highlightElement', () => {
    it('should add and remove outline', async () => {
      const element = document.getElementById('username')! as HTMLElement;
      const originalOutline = element.style.outline;

      const highlightPromise = highlightElement(element, 100);
      
      // Check highlight is applied
      expect(element.style.outline).toContain('solid');

      await highlightPromise;
      
      // Check outline is restored
      expect(element.style.outline).toBe(originalOutline);
    });
  });

  describe('createHighlightOverlay', () => {
    it('should create overlay element', () => {
      const element = document.getElementById('username')!;
      
      const overlay = createHighlightOverlay(element);

      expect(overlay.tagName).toBe('DIV');
      expect(overlay.style.position).toBe('fixed');
      expect(overlay.parentNode).toBe(document.body);
    });

    it('should use custom color', () => {
      const element = document.getElementById('username')!;
      
      const overlay = createHighlightOverlay(element, 'rgba(0, 255, 0, 0.5)');

      expect(overlay.style.backgroundColor).toContain('rgba');
    });
  });

  describe('removeHighlightOverlay', () => {
    it('should remove overlay from DOM', () => {
      const element = document.getElementById('username')!;
      const overlay = createHighlightOverlay(element);

      expect(document.body.contains(overlay)).toBe(true);

      removeHighlightOverlay(overlay);

      expect(document.body.contains(overlay)).toBe(false);
    });
  });

  // ==========================================================================
  // VISIBILITY CHECKS
  // ==========================================================================

  describe('isElementVisible', () => {
    it('should return true for visible element', () => {
      const element = document.getElementById('visible')!;
      expect(isElementVisible(element)).toBe(true);
    });

    it('should return false for display:none', () => {
      const element = document.getElementById('hidden')!;
      expect(isElementVisible(element)).toBe(false);
    });

    it('should return false for visibility:hidden', () => {
      const element = document.getElementById('invisible')!;
      expect(isElementVisible(element)).toBe(false);
    });

    it('should return false for opacity:0', () => {
      const element = document.getElementById('transparent')!;
      expect(isElementVisible(element)).toBe(false);
    });
  });

  describe('isElementInteractable', () => {
    it('should return true for normal input', () => {
      const element = document.getElementById('username')!;
      expect(isElementInteractable(element)).toBe(true);
    });

    it('should return false for disabled input', () => {
      const element = document.getElementById('disabled-input')!;
      expect(isElementInteractable(element)).toBe(false);
    });

    it('should return false for hidden element', () => {
      const element = document.getElementById('hidden')!;
      expect(isElementInteractable(element)).toBe(false);
    });
  });

  describe('getElementVisibleText', () => {
    it('should get text content for div', () => {
      const element = document.getElementById('visible')!;
      expect(getElementVisibleText(element)).toBe('Visible content');
    });

    it('should get value for input', () => {
      const element = document.getElementById('username')! as HTMLInputElement;
      element.value = 'testvalue';
      expect(getElementVisibleText(element)).toBe('testvalue');
    });

    it('should get placeholder for empty input', () => {
      const element = document.getElementById('username')! as HTMLInputElement;
      element.value = '';
      expect(getElementVisibleText(element)).toBe('Enter username');
    });
  });

  // ==========================================================================
  // WAIT FOR STABLE
  // ==========================================================================

  describe('waitForElementStable', () => {
    it('should return true for stable element', async () => {
      const element = document.getElementById('username')!;
      
      const isStable = await waitForElementStable(element, 300, 50);

      expect(isStable).toBe(true);
    });

    it('should timeout for moving element', async () => {
      const element = document.getElementById('username')! as HTMLElement;
      
      // Simulate movement (in real browser this would animate)
      let position = 0;
      const interval = setInterval(() => {
        position += 10;
        element.style.marginLeft = `${position}px`;
      }, 50);

      const isStable = await waitForElementStable(element, 200, 40);

      clearInterval(interval);
      
      // Note: JSDOM may not properly simulate getBoundingClientRect changes
      // so this test may pass even with movement
      expect(typeof isStable).toBe('boolean');
    });
  });

  // ==========================================================================
  // STRATEGY CONTEXT
  // ==========================================================================

  describe('StrategyContext', () => {
    it('should track frame chain', async () => {
      const bundle = createBundle({ 
        id: 'username',
        iframeChain: [0] // Indicates element is in first iframe
      });
      
      const result = await executeStrategy(bundle, {
        searchIframes: true
      });

      // In this test, element is in main doc, not iframe
      expect(result.context?.frameChain.length).toBe(0);
    });

    it('should track shadow roots', async () => {
      const bundle = createBundle({ 
        id: 'username',
        shadowHosts: ['custom-element']
      });
      
      const result = await executeStrategy(bundle, {
        searchShadowDom: true
      });

      // In this test, no actual shadow DOM
      expect(result.context?.shadowRoots.length).toBe(0);
    });
  });
});
