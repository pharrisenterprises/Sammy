/**
 * @fileoverview Tests for LocatorBundle type definitions
 * @module core/types/locator-bundle.test
 */

import { describe, it, expect } from 'vitest';
import {
  type LocatorBundle,
  type BoundingBox,
  LOCATOR_TIERS,
  ELEMENT_TIMEOUT_MS,
  RETRY_INTERVAL_MS,
  BOUNDING_BOX_RADIUS_PX,
  FUZZY_TEXT_THRESHOLD,
  isBoundingBox,
  isLocatorBundle,
  hasXPath,
  hasId,
  hasName,
  hasAria,
  hasPlaceholder,
  hasDataAttrs,
  hasText,
  hasBounding,
  isInIframe,
  isInShadowDom,
  createEmptyBundle,
  createBundle,
  createBoundingBox,
  createBoundingBoxFromClick,
  createMinimalBundle,
  getAvailableStrategies,
  getBestStrategy,
  countAvailableStrategies,
  calculateBundleQuality,
  mergeBundle,
  cloneBundle,
  extractCssSelector,
  getBoundingCenter,
  isPointInBounding,
  validateBundle,
  isValidBundle
} from './locator-bundle';

describe('LocatorBundle Types', () => {
  // ==========================================================================
  // CONSTANTS
  // ==========================================================================

  describe('Constants', () => {
    it('should have correct locator tier values', () => {
      expect(LOCATOR_TIERS.XPATH.confidence).toBe(1.0);
      expect(LOCATOR_TIERS.ID.confidence).toBe(0.9);
      expect(LOCATOR_TIERS.NAME.confidence).toBe(0.8);
      expect(LOCATOR_TIERS.ARIA.confidence).toBe(0.75);
      expect(LOCATOR_TIERS.PLACEHOLDER.confidence).toBe(0.7);
      expect(LOCATOR_TIERS.DATA_ATTRS.confidence).toBe(0.65);
      expect(LOCATOR_TIERS.FUZZY_TEXT.confidence).toBe(0.5);
      expect(LOCATOR_TIERS.BOUNDING_BOX.confidence).toBe(0.3);
      expect(LOCATOR_TIERS.RETRY.confidence).toBe(0.1);
    });

    it('should have correct timeout values', () => {
      expect(ELEMENT_TIMEOUT_MS).toBe(2000);
      expect(RETRY_INTERVAL_MS).toBe(150);
    });

    it('should have correct threshold values', () => {
      expect(BOUNDING_BOX_RADIUS_PX).toBe(200);
      expect(FUZZY_TEXT_THRESHOLD).toBe(0.4);
    });
  });

  // ==========================================================================
  // TYPE GUARDS
  // ==========================================================================

  describe('isBoundingBox', () => {
    it('should return true for valid bounding box', () => {
      const bbox: BoundingBox = { x: 10, y: 20, width: 100, height: 50 };
      expect(isBoundingBox(bbox)).toBe(true);
    });

    it('should return false for null/undefined', () => {
      expect(isBoundingBox(null)).toBe(false);
      expect(isBoundingBox(undefined)).toBe(false);
    });

    it('should return false for missing properties', () => {
      expect(isBoundingBox({ x: 10, y: 20 })).toBe(false);
      expect(isBoundingBox({ x: 10, y: 20, width: 100 })).toBe(false);
    });

    it('should return false for wrong property types', () => {
      expect(isBoundingBox({ x: '10', y: 20, width: 100, height: 50 })).toBe(false);
    });
  });

  describe('isLocatorBundle', () => {
    const validBundle: LocatorBundle = {
      tag: 'input',
      id: 'username',
      name: 'user',
      placeholder: 'Enter username',
      aria: 'Username field',
      dataAttrs: { testid: 'login-username' },
      text: '',
      css: 'input#username',
      xpath: '/html/body/form/input',
      classes: ['form-control'],
      pageUrl: 'https://example.com',
      bounding: { x: 10, y: 20, width: 100, height: 40 },
      iframeChain: null,
      shadowHosts: null
    };

    it('should return true for valid bundle with all 14 properties', () => {
      expect(isLocatorBundle(validBundle)).toBe(true);
    });

    it('should return true for bundle with iframe chain', () => {
      const bundleWithIframe = { ...validBundle, iframeChain: [0, 1] };
      expect(isLocatorBundle(bundleWithIframe)).toBe(true);
    });

    it('should return true for bundle with shadow hosts', () => {
      const bundleWithShadow = { ...validBundle, shadowHosts: ['#host1', '#host2'] };
      expect(isLocatorBundle(bundleWithShadow)).toBe(true);
    });

    it('should return false for null/undefined', () => {
      expect(isLocatorBundle(null)).toBe(false);
      expect(isLocatorBundle(undefined)).toBe(false);
    });

    it('should return false for missing original 8 properties', () => {
      const { tag, ...withoutTag } = validBundle;
      expect(isLocatorBundle(withoutTag)).toBe(false);

      const { dataAttrs, ...withoutDataAttrs } = validBundle;
      expect(isLocatorBundle(withoutDataAttrs)).toBe(false);
    });

    it('should return false for missing added 6 properties', () => {
      const { xpath, ...withoutXpath } = validBundle;
      expect(isLocatorBundle(withoutXpath)).toBe(false);

      const { classes, ...withoutClasses } = validBundle;
      expect(isLocatorBundle(withoutClasses)).toBe(false);

      const { pageUrl, ...withoutPageUrl } = validBundle;
      expect(isLocatorBundle(withoutPageUrl)).toBe(false);
    });

    it('should return false for invalid bounding', () => {
      const invalidBounding = { ...validBundle, bounding: { x: 10 } };
      expect(isLocatorBundle(invalidBounding)).toBe(false);
    });

    it('should return false for invalid iframeChain', () => {
      const invalidIframe = { ...validBundle, iframeChain: 'not an array' };
      expect(isLocatorBundle(invalidIframe)).toBe(false);
    });

    it('should return false for invalid shadowHosts', () => {
      const invalidShadow = { ...validBundle, shadowHosts: 'not an array' };
      expect(isLocatorBundle(invalidShadow)).toBe(false);
    });
  });

  describe('Strategy checkers', () => {
    const fullBundle = createBundle({
      tag: 'button',
      xpath: '/html/body/button',
      id: 'submit-btn',
      name: 'submit',
      aria: 'Submit form',
      placeholder: 'Click here',
      dataAttrs: { testid: 'submit' },
      text: 'Submit',
      bounding: { x: 0, y: 0, width: 100, height: 40 }
    });

    const emptyBundle = createEmptyBundle();

    it('hasXPath should work correctly', () => {
      expect(hasXPath(fullBundle)).toBe(true);
      expect(hasXPath(emptyBundle)).toBe(false);
    });

    it('hasId should work correctly', () => {
      expect(hasId(fullBundle)).toBe(true);
      expect(hasId(emptyBundle)).toBe(false);
    });

    it('hasName should work correctly', () => {
      expect(hasName(fullBundle)).toBe(true);
      expect(hasName(emptyBundle)).toBe(false);
    });

    it('hasAria should work correctly', () => {
      expect(hasAria(fullBundle)).toBe(true);
      expect(hasAria(emptyBundle)).toBe(false);
    });

    it('hasPlaceholder should work correctly', () => {
      expect(hasPlaceholder(fullBundle)).toBe(true);
      expect(hasPlaceholder(emptyBundle)).toBe(false);
    });

    it('hasDataAttrs should work correctly', () => {
      expect(hasDataAttrs(fullBundle)).toBe(true);
      expect(hasDataAttrs(emptyBundle)).toBe(false);
    });

    it('hasText should work correctly', () => {
      expect(hasText(fullBundle)).toBe(true);
      expect(hasText(emptyBundle)).toBe(false);
    });

    it('hasBounding should work correctly', () => {
      expect(hasBounding(fullBundle)).toBe(true);
      expect(hasBounding(emptyBundle)).toBe(false);
    });
  });

  describe('isInIframe / isInShadowDom', () => {
    it('should detect iframe context', () => {
      const inIframe = createBundle({ iframeChain: [0, 1] });
      const notInIframe = createBundle({ iframeChain: null });
      const emptyIframe = createBundle({ iframeChain: [] });

      expect(isInIframe(inIframe)).toBe(true);
      expect(isInIframe(notInIframe)).toBe(false);
      expect(isInIframe(emptyIframe)).toBe(false);
    });

    it('should detect shadow DOM context', () => {
      const inShadow = createBundle({ shadowHosts: ['#host'] });
      const notInShadow = createBundle({ shadowHosts: null });
      const emptyShadow = createBundle({ shadowHosts: [] });

      expect(isInShadowDom(inShadow)).toBe(true);
      expect(isInShadowDom(notInShadow)).toBe(false);
      expect(isInShadowDom(emptyShadow)).toBe(false);
    });
  });

  // ==========================================================================
  // FACTORY FUNCTIONS
  // ==========================================================================

  describe('createEmptyBundle', () => {
    it('should create bundle with all 14 properties', () => {
      const bundle = createEmptyBundle();

      expect(bundle.tag).toBe('');
      expect(bundle.id).toBe('');
      expect(bundle.name).toBe('');
      expect(bundle.placeholder).toBe('');
      expect(bundle.aria).toBe('');
      expect(bundle.dataAttrs).toEqual({});
      expect(bundle.text).toBe('');
      expect(bundle.css).toBe('');
      expect(bundle.xpath).toBe('');
      expect(bundle.classes).toEqual([]);
      expect(bundle.pageUrl).toBe('');
      expect(bundle.bounding).toBeNull();
      expect(bundle.iframeChain).toBeNull();
      expect(bundle.shadowHosts).toBeNull();
    });

    it('should return valid bundle structure', () => {
      const bundle = createEmptyBundle();
      expect(isLocatorBundle(bundle)).toBe(true);
    });
  });

  describe('createBundle', () => {
    it('should fill in missing properties with defaults', () => {
      const bundle = createBundle({
        tag: 'button',
        id: 'submit'
      });

      expect(bundle.tag).toBe('button');
      expect(bundle.id).toBe('submit');
      expect(bundle.name).toBe('');
      expect(bundle.xpath).toBe('');
      expect(bundle.classes).toEqual([]);
      expect(bundle.bounding).toBeNull();
    });

    it('should preserve provided values', () => {
      const bundle = createBundle({
        tag: 'input',
        xpath: '/html/body/input',
        bounding: { x: 10, y: 20, width: 100, height: 40 },
        iframeChain: [0],
        shadowHosts: ['#host']
      });

      expect(bundle.xpath).toBe('/html/body/input');
      expect(bundle.bounding).toEqual({ x: 10, y: 20, width: 100, height: 40 });
      expect(bundle.iframeChain).toEqual([0]);
      expect(bundle.shadowHosts).toEqual(['#host']);
    });
  });

  describe('createBoundingBox', () => {
    it('should create bounding box from coordinates', () => {
      const bbox = createBoundingBox(10, 20, 100, 50);

      expect(bbox.x).toBe(10);
      expect(bbox.y).toBe(20);
      expect(bbox.width).toBe(100);
      expect(bbox.height).toBe(50);
    });
  });

  describe('createBoundingBoxFromClick', () => {
    it('should create centered bounding box', () => {
      const bbox = createBoundingBoxFromClick(100, 100);

      expect(bbox.x).toBe(50);  // 100 - 100/2
      expect(bbox.y).toBe(80);  // 100 - 40/2
      expect(bbox.width).toBe(100);
      expect(bbox.height).toBe(40);
    });

    it('should use custom size', () => {
      const bbox = createBoundingBoxFromClick(200, 200, { width: 200, height: 100 });

      expect(bbox.x).toBe(100); // 200 - 200/2
      expect(bbox.y).toBe(150); // 200 - 100/2
      expect(bbox.width).toBe(200);
      expect(bbox.height).toBe(100);
    });
  });

  describe('createMinimalBundle', () => {
    it('should create minimal bundle', () => {
      const bundle = createMinimalBundle('button', '/html/body/button');

      expect(bundle.tag).toBe('button');
      expect(bundle.xpath).toBe('/html/body/button');
      expect(bundle.bounding).toBeNull();
    });

    it('should include bounding if provided', () => {
      const bundle = createMinimalBundle('input', '/path', { x: 0, y: 0, width: 100, height: 40 });
      expect(bundle.bounding).toEqual({ x: 0, y: 0, width: 100, height: 40 });
    });
  });

  // ==========================================================================
  // STRATEGY FUNCTIONS
  // ==========================================================================

  describe('getAvailableStrategies', () => {
    it('should return strategies in priority order', () => {
      const bundle = createBundle({
        xpath: '/path',
        id: 'myid',
        name: 'myname',
        text: 'Some text'
      });

      const strategies = getAvailableStrategies(bundle);

      expect(strategies[0].tier).toBe('XPATH');
      expect(strategies[1].tier).toBe('ID');
      expect(strategies[2].tier).toBe('NAME');
      expect(strategies[3].tier).toBe('FUZZY_TEXT');
    });

    it('should only return available strategies', () => {
      const bundle = createBundle({
        id: 'myid',
        bounding: { x: 0, y: 0, width: 100, height: 40 }
      });

      const strategies = getAvailableStrategies(bundle);

      expect(strategies).toHaveLength(2);
      expect(strategies.map(s => s.tier)).toEqual(['ID', 'BOUNDING_BOX']);
    });

    it('should return empty array for empty bundle', () => {
      const bundle = createEmptyBundle();
      expect(getAvailableStrategies(bundle)).toHaveLength(0);
    });
  });

  describe('getBestStrategy', () => {
    it('should return highest confidence strategy', () => {
      const bundle = createBundle({
        id: 'myid',
        xpath: '/path'
      });

      const best = getBestStrategy(bundle);

      expect(best?.tier).toBe('XPATH');
      expect(best?.confidence).toBe(1.0);
    });

    it('should return null for empty bundle', () => {
      const bundle = createEmptyBundle();
      expect(getBestStrategy(bundle)).toBeNull();
    });
  });

  describe('countAvailableStrategies', () => {
    it('should count correctly', () => {
      const full = createBundle({
        xpath: '/path',
        id: 'id',
        name: 'name',
        aria: 'aria',
        placeholder: 'placeholder',
        dataAttrs: { key: 'value' },
        text: 'text',
        bounding: { x: 0, y: 0, width: 100, height: 40 }
      });

      expect(countAvailableStrategies(full)).toBe(8);
      expect(countAvailableStrategies(createEmptyBundle())).toBe(0);
    });
  });

  describe('calculateBundleQuality', () => {
    it('should calculate high quality for full bundle', () => {
      const full = createBundle({
        xpath: '/path',
        id: 'id',
        name: 'name',
        aria: 'aria',
        placeholder: 'placeholder',
        dataAttrs: { key: 'value' },
        text: 'text',
        bounding: { x: 0, y: 0, width: 100, height: 40 }
      });

      expect(calculateBundleQuality(full)).toBe(100);
    });

    it('should calculate zero for empty bundle', () => {
      expect(calculateBundleQuality(createEmptyBundle())).toBe(0);
    });

    it('should weight primary strategies higher', () => {
      const withXpath = createBundle({ xpath: '/path' });
      const withText = createBundle({ text: 'text' });

      expect(calculateBundleQuality(withXpath)).toBeGreaterThan(calculateBundleQuality(withText));
    });
  });

  // ==========================================================================
  // UTILITY FUNCTIONS
  // ==========================================================================

  describe('mergeBundle', () => {
    it('should prefer non-empty override values', () => {
      const base = createBundle({ id: 'base-id', name: 'base-name' });
      const override = { id: 'new-id' };

      const merged = mergeBundle(base, override);

      expect(merged.id).toBe('new-id');
      expect(merged.name).toBe('base-name');
    });

    it('should merge dataAttrs', () => {
      const base = createBundle({ dataAttrs: { a: '1' } });
      const override = { dataAttrs: { b: '2' } };

      const merged = mergeBundle(base, override);

      expect(merged.dataAttrs).toEqual({ a: '1', b: '2' });
    });
  });

  describe('cloneBundle', () => {
    it('should create deep copy', () => {
      const original = createBundle({
        id: 'test',
        dataAttrs: { key: 'value' },
        classes: ['a', 'b'],
        bounding: { x: 10, y: 20, width: 100, height: 40 },
        iframeChain: [0, 1]
      });

      const cloned = cloneBundle(original);

      // Modify original
      original.dataAttrs.key = 'modified';
      original.classes.push('c');
      original.bounding!.x = 999;
      original.iframeChain!.push(2);

      // Clone should be unaffected
      expect(cloned.dataAttrs.key).toBe('value');
      expect(cloned.classes).toEqual(['a', 'b']);
      expect(cloned.bounding!.x).toBe(10);
      expect(cloned.iframeChain).toEqual([0, 1]);
    });
  });

  describe('extractCssSelector', () => {
    it('should build selector from attributes', () => {
      const bundle = createBundle({
        tag: 'button',
        id: 'submit',
        classes: ['btn', 'primary'],
        name: 'submit-btn'
      });

      const selector = extractCssSelector(bundle);

      expect(selector).toContain('button');
      expect(selector).toContain('#submit');
      expect(selector).toContain('.btn');
      expect(selector).toContain('.primary');
      expect(selector).toContain('[name="submit-btn"]');
    });

    it('should use * for missing tag', () => {
      const bundle = createBundle({ id: 'test' });
      expect(extractCssSelector(bundle)).toMatch(/^\*#test/);
    });
  });

  describe('getBoundingCenter', () => {
    it('should calculate center correctly', () => {
      const bbox: BoundingBox = { x: 100, y: 200, width: 50, height: 30 };
      const center = getBoundingCenter(bbox);

      expect(center.x).toBe(125); // 100 + 50/2
      expect(center.y).toBe(215); // 200 + 30/2
    });
  });

  describe('isPointInBounding', () => {
    const bbox: BoundingBox = { x: 100, y: 100, width: 50, height: 50 };

    it('should return true for point inside', () => {
      expect(isPointInBounding(bbox, 125, 125, 0)).toBe(true);
    });

    it('should return false for point outside', () => {
      expect(isPointInBounding(bbox, 0, 0, 0)).toBe(false);
    });

    it('should consider radius tolerance', () => {
      // Point just outside the box
      expect(isPointInBounding(bbox, 95, 125, 0)).toBe(false);
      expect(isPointInBounding(bbox, 95, 125, 10)).toBe(true);
    });
  });

  // ==========================================================================
  // VALIDATION
  // ==========================================================================

  describe('validateBundle', () => {
    it('should return empty array for valid bundle', () => {
      const bundle = createBundle({ xpath: '/path' });
      expect(validateBundle(bundle)).toEqual([]);
    });

    it('should return error for bundle without any strategy', () => {
      const errors = validateBundle({});
      expect(errors.some(e => e.field === 'general')).toBe(true);
    });

    it('should validate iframeChain', () => {
      const errors = validateBundle({
        xpath: '/path',
        iframeChain: ['not', 'numbers'] as any
      });
      expect(errors.some(e => e.field === 'iframeChain')).toBe(true);
    });

    it('should validate shadowHosts', () => {
      const errors = validateBundle({
        xpath: '/path',
        shadowHosts: [1, 2, 3] as any
      });
      expect(errors.some(e => e.field === 'shadowHosts')).toBe(true);
    });
  });

  describe('isValidBundle', () => {
    it('should return true for valid bundle', () => {
      expect(isValidBundle(createBundle({ id: 'test' }))).toBe(true);
    });

    it('should return false for invalid bundle', () => {
      expect(isValidBundle({})).toBe(false);
    });
  });
});
