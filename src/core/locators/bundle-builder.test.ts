/**
 * @fileoverview Tests for bundle builder
 * @module core/locators/bundle-builder.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  buildBundle,
  buildBundleFromEvent,
  buildBundleFromPoint,
  getBuildContext,
  isInIframe,
  isInShadowDom,
  buildXPath,
  buildOptimizedXPath,
  buildCssSelector,
  buildOptimizedCssSelector,
  enhanceBundle,
  mergeBundles,
  validateBundle,
  DEFAULT_BUILD_OPTIONS
} from './bundle-builder';
import { createEmptyBundle } from '../types';

describe('Bundle Builder', () => {
  let dom: JSDOM;
  let document: Document;
  let window: Window;

  beforeEach(() => {
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <form id="login-form">
            <label for="username">Username</label>
            <input 
              id="username" 
              name="username" 
              type="text" 
              placeholder="Enter username"
              aria-label="Username input"
              data-testid="user-input"
              data-qa="username-field"
              class="input-field primary"
            >
            <input 
              id="password" 
              name="password" 
              type="password" 
              placeholder="Enter password"
            >
            <button id="submit-btn" type="submit" class="btn btn-primary">
              Log In
            </button>
          </form>
          <div id="content" class="main-content">
            <p class="message">Welcome to the site</p>
            <a href="/home" data-nav="home">Home</a>
            <span>Plain text element</span>
          </div>
          <div id="no-attrs">
            <div>
              <span>Deeply nested</span>
            </div>
          </div>
        </body>
      </html>
    `, { 
      url: 'http://localhost/test-page',
      runScripts: 'dangerously'
    });
    document = dom.window.document;
    window = dom.window as unknown as Window;

    global.document = document;
    global.window = window as any;
  });

  afterEach(() => {
    dom.window.close();
  });

  // ==========================================================================
  // DEFAULT OPTIONS
  // ==========================================================================

  describe('DEFAULT_BUILD_OPTIONS', () => {
    it('should have correct defaults', () => {
      expect(DEFAULT_BUILD_OPTIONS.maxTextLength).toBe(100);
      expect(DEFAULT_BUILD_OPTIONS.maxClasses).toBe(10);
      expect(DEFAULT_BUILD_OPTIONS.maxDataAttrs).toBe(10);
    });
  });

  // ==========================================================================
  // BUILD BUNDLE
  // ==========================================================================

  describe('buildBundle', () => {
    it('should capture all 14 properties', () => {
      const element = document.getElementById('username')!;
      const result = buildBundle(element);

      // Verify all 14 properties exist
      expect(result.bundle.tag).toBeDefined();
      expect(result.bundle.id).toBeDefined();
      expect(result.bundle.name).toBeDefined();
      expect(result.bundle.placeholder).toBeDefined();
      expect(result.bundle.aria).toBeDefined();
      expect(result.bundle.text).toBeDefined();
      expect(result.bundle.dataAttrs).toBeDefined();
      expect(result.bundle.css).toBeDefined();
      expect(result.bundle.xpath).toBeDefined();
      expect(result.bundle.classes).toBeDefined();
      expect(result.bundle.pageUrl).toBeDefined();
      expect(result.bundle.bounding).toBeDefined();
      expect('iframeChain' in result.bundle).toBe(true);
      expect('shadowHosts' in result.bundle).toBe(true);
    });

    it('should capture correct tag name', () => {
      const element = document.getElementById('username')!;
      const result = buildBundle(element);

      expect(result.bundle.tag).toBe('input');
    });

    it('should capture ID', () => {
      const element = document.getElementById('username')!;
      const result = buildBundle(element);

      expect(result.bundle.id).toBe('username');
    });

    it('should capture name attribute', () => {
      const element = document.getElementById('username')!;
      const result = buildBundle(element);

      expect(result.bundle.name).toBe('username');
    });

    it('should capture placeholder', () => {
      const element = document.getElementById('username')!;
      const result = buildBundle(element);

      expect(result.bundle.placeholder).toBe('Enter username');
    });

    it('should capture aria-label', () => {
      const element = document.getElementById('username')!;
      const result = buildBundle(element);

      expect(result.bundle.aria).toBe('Username input');
    });

    it('should capture text content', () => {
      const element = document.getElementById('submit-btn')!;
      const result = buildBundle(element);

      expect(result.bundle.text).toContain('Log In');
    });

    it('should capture data attributes', () => {
      const element = document.getElementById('username')!;
      const result = buildBundle(element);

      expect(result.bundle.dataAttrs).toHaveProperty('testid', 'user-input');
      expect(result.bundle.dataAttrs).toHaveProperty('qa', 'username-field');
    });

    it('should capture CSS classes', () => {
      const element = document.getElementById('username')!;
      const result = buildBundle(element);

      expect(result.bundle.classes).toContain('input-field');
      expect(result.bundle.classes).toContain('primary');
    });

    it('should capture page URL', () => {
      const element = document.getElementById('username')!;
      const result = buildBundle(element);

      expect(result.bundle.pageUrl).toContain('localhost');
    });

    it('should capture bounding box', () => {
      const element = document.getElementById('username')!;
      const result = buildBundle(element);

      expect(result.bundle.bounding).toHaveProperty('x');
      expect(result.bundle.bounding).toHaveProperty('y');
      expect(result.bundle.bounding).toHaveProperty('width');
      expect(result.bundle.bounding).toHaveProperty('height');
    });

    it('should generate XPath', () => {
      const element = document.getElementById('username')!;
      const result = buildBundle(element);

      expect(result.bundle.xpath).toContain('username');
    });

    it('should generate CSS selector', () => {
      const element = document.getElementById('username')!;
      const result = buildBundle(element);

      expect(result.bundle.css).toContain('username');
    });

    it('should set iframeChain to null when not in iframe', () => {
      const element = document.getElementById('username')!;
      const result = buildBundle(element);

      expect(result.bundle.iframeChain).toBeNull();
    });

    it('should set shadowHosts to null when not in shadow DOM', () => {
      const element = document.getElementById('username')!;
      const result = buildBundle(element);

      expect(result.bundle.shadowHosts).toBeNull();
    });

    it('should calculate quality score', () => {
      const element = document.getElementById('username')!;
      const result = buildBundle(element);

      expect(result.qualityScore).toBeGreaterThan(0);
      expect(result.qualityScore).toBeLessThanOrEqual(100);
    });

    it('should return duration', () => {
      const element = document.getElementById('username')!;
      const result = buildBundle(element);

      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should add warnings for element without good locators', () => {
      const element = document.querySelector('#no-attrs div span')!;
      const result = buildBundle(element);

      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // BUILD FROM EVENT
  // ==========================================================================

  describe('buildBundleFromEvent', () => {
    it('should build bundle from click event', () => {
      const element = document.getElementById('submit-btn')!;
      const event = new (window as any).MouseEvent('click', { bubbles: true });
      Object.defineProperty(event, 'target', { value: element });

      const result = buildBundleFromEvent(event);

      expect(result).not.toBeNull();
      expect(result!.bundle.id).toBe('submit-btn');
    });

    it('should return null for non-element target', () => {
      const event = new (window as any).MouseEvent('click');
      Object.defineProperty(event, 'target', { value: null });

      const result = buildBundleFromEvent(event);

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // BUILD FROM POINT
  // ==========================================================================

  describe('buildBundleFromPoint', () => {
    it('should return null when no element at point', () => {
      const result = buildBundleFromPoint(-1000, -1000, document);
      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // CONTEXT DETECTION
  // ==========================================================================

  describe('getBuildContext', () => {
    it('should return context with document and window', () => {
      const element = document.getElementById('username')!;
      const context = getBuildContext(element);

      expect(context.document).toBe(document);
      expect(context.window).toBeDefined();
    });

    it('should return empty iframe array for non-iframe element', () => {
      const element = document.getElementById('username')!;
      const context = getBuildContext(element);

      expect(context.iframes).toHaveLength(0);
    });

    it('should return empty shadow hosts for non-shadow element', () => {
      const element = document.getElementById('username')!;
      const context = getBuildContext(element);

      expect(context.shadowHosts).toHaveLength(0);
    });
  });

  describe('isInIframe', () => {
    it('should return false for main document element', () => {
      const element = document.getElementById('username')!;
      expect(isInIframe(element)).toBe(false);
    });
  });

  describe('isInShadowDom', () => {
    it('should return false for regular element', () => {
      const element = document.getElementById('username')!;
      expect(isInShadowDom(element)).toBe(false);
    });
  });

  // ==========================================================================
  // XPATH BUILDER
  // ==========================================================================

  describe('buildXPath', () => {
    it('should build XPath with ID', () => {
      const element = document.getElementById('username')!;
      const xpath = buildXPath(element);

      expect(xpath).toBe('//*[@id="username"]');
    });

    it('should build positional XPath without ID', () => {
      const element = document.querySelector('.message')!;
      const xpath = buildXPath(element);

      expect(xpath).toContain('/');
      expect(xpath).toContain('p');
    });

    it('should include index for elements with siblings', () => {
      const element = document.querySelector('input[type="password"]')!;
      const xpath = buildXPath(element);

      // Should either use ID or include position
      expect(xpath).toMatch(/input|password/);
    });
  });

  describe('buildOptimizedXPath', () => {
    it('should prefer ID', () => {
      const element = document.getElementById('username')!;
      const xpath = buildOptimizedXPath(element);

      expect(xpath).toBe('//*[@id="username"]');
    });

    it('should use name if no ID', () => {
      const element = document.getElementById('username')!;
      // Remove ID temporarily
      element.removeAttribute('id');

      const xpath = buildOptimizedXPath(element);

      expect(xpath).toContain('@name="username"');
    });

    it('should use data-testid if available', () => {
      const element = document.getElementById('username')!;
      element.removeAttribute('id');
      element.removeAttribute('name');

      const xpath = buildOptimizedXPath(element);

      expect(xpath).toContain('testid');
    });
  });

  // ==========================================================================
  // CSS SELECTOR BUILDER
  // ==========================================================================

  describe('buildCssSelector', () => {
    it('should build selector with ID', () => {
      const element = document.getElementById('username')!;
      const css = buildCssSelector(element);

      expect(css).toBe('#username');
    });

    it('should include classes for elements without ID', () => {
      const element = document.querySelector('.message')!;
      const css = buildCssSelector(element);

      expect(css).toContain('.message');
    });
  });

  describe('buildOptimizedCssSelector', () => {
    it('should prefer ID', () => {
      const element = document.getElementById('username')!;
      const css = buildOptimizedCssSelector(element);

      expect(css).toBe('#username');
    });
  });

  // ==========================================================================
  // BUNDLE ENHANCEMENT
  // ==========================================================================

  describe('enhanceBundle', () => {
    it('should update bounding and pageUrl', () => {
      const element = document.getElementById('username')!;
      const originalBundle = buildBundle(element).bundle;
      
      const enhanced = enhanceBundle(originalBundle, element);

      expect(enhanced.bounding).toBeDefined();
      expect(enhanced.pageUrl).toBeDefined();
    });

    it('should preserve original xpath if exists', () => {
      const element = document.getElementById('username')!;
      const originalBundle = buildBundle(element).bundle;
      originalBundle.xpath = '/custom/xpath';
      
      const enhanced = enhanceBundle(originalBundle, element);

      expect(enhanced.xpath).toBe('/custom/xpath');
    });
  });

  describe('mergeBundles', () => {
    it('should prefer primary values', () => {
      const primary = createEmptyBundle();
      primary.id = 'primary-id';
      primary.name = '';
      
      const secondary = createEmptyBundle();
      secondary.id = 'secondary-id';
      secondary.name = 'secondary-name';

      const merged = mergeBundles(primary, secondary);

      expect(merged.id).toBe('primary-id');
      expect(merged.name).toBe('secondary-name');
    });

    it('should merge data attributes', () => {
      const primary = createEmptyBundle();
      primary.dataAttrs = { a: '1' };
      
      const secondary = createEmptyBundle();
      secondary.dataAttrs = { b: '2' };

      const merged = mergeBundles(primary, secondary);

      expect(merged.dataAttrs).toEqual({ a: '1', b: '2' });
    });
  });

  // ==========================================================================
  // VALIDATION
  // ==========================================================================

  describe('validateBundle', () => {
    it('should validate bundle with ID', () => {
      const element = document.getElementById('username')!;
      const bundle = buildBundle(element).bundle;

      const result = validateBundle(bundle);

      expect(result.valid).toBe(true);
      expect(result.missingProperties).toHaveLength(0);
    });

    it('should report missing tag', () => {
      const bundle = createEmptyBundle();
      bundle.tag = '';

      const result = validateBundle(bundle);

      expect(result.valid).toBe(false);
      expect(result.missingProperties).toContain('tag');
    });

    it('should report missing locator', () => {
      const bundle = createEmptyBundle();
      bundle.tag = 'input';
      bundle.id = '';
      bundle.xpath = '';
      bundle.css = '';

      const result = validateBundle(bundle);

      expect(result.valid).toBe(false);
      expect(result.missingProperties.some(p => p.includes('locator'))).toBe(true);
    });

    it('should return quality score', () => {
      const element = document.getElementById('username')!;
      const bundle = buildBundle(element).bundle;

      const result = validateBundle(bundle);

      expect(result.score).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // ARIA LABEL DETECTION
  // ==========================================================================

  describe('Aria Label Detection', () => {
    it('should detect aria-label attribute', () => {
      const element = document.getElementById('username')!;
      const result = buildBundle(element);

      expect(result.bundle.aria).toBe('Username input');
    });

    it('should detect label[for] association', () => {
      // The label is associated via for="username"
      const element = document.getElementById('username')!;
      // Remove aria-label to test label association
      element.removeAttribute('aria-label');

      const result = buildBundle(element);

      expect(result.bundle.aria).toBe('Username');
    });
  });

  // ==========================================================================
  // TEXT CONTENT EXTRACTION
  // ==========================================================================

  describe('Text Content Extraction', () => {
    it('should get button text', () => {
      const element = document.getElementById('submit-btn')!;
      const result = buildBundle(element);

      expect(result.bundle.text.trim()).toBe('Log In');
    });

    it('should truncate long text', () => {
      const element = document.createElement('div');
      element.textContent = 'A'.repeat(200);
      document.body.appendChild(element);

      const result = buildBundle(element, { maxTextLength: 50 });

      expect(result.bundle.text.length).toBeLessThanOrEqual(50);
    });
  });
});
