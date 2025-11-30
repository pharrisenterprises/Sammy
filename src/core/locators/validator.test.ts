/**
 * @fileoverview Tests for locator validator
 * @module core/locators/validator.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  validateBundle,
  verifyElementMatch,
  findMatchingElements,
  generateDiagnosticReport,
  formatDiagnosticReport,
  isValidBundle,
  getQualityLevel,
  VALIDATION_CODES
} from './validator';
import { createBundle, createEmptyBundle } from '../types';

describe('Validator', () => {
  let dom: JSDOM;
  let document: Document;

  beforeEach(() => {
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <form id="login-form">
            <input 
              id="username" 
              name="username" 
              type="text" 
              placeholder="Enter username"
              aria-label="Username field"
              data-testid="user-input"
              class="input-field primary"
            >
            <input 
              id="password" 
              name="password" 
              type="password" 
            >
            <button id="submit-btn" type="submit">Log In</button>
          </form>
          <div id="content">
            <p class="message">Welcome to the site</p>
          </div>
        </body>
      </html>
    `, { url: 'http://localhost/test' });
    document = dom.window.document;
    global.document = document;
  });

  afterEach(() => {
    dom.window.close();
  });

  // ==========================================================================
  // VALIDATE BUNDLE
  // ==========================================================================

  describe('validateBundle', () => {
    it('should validate bundle with all properties', () => {
      const bundle = createBundle({
        tag: 'input',
        id: 'username',
        name: 'username',
        xpath: '//*[@id="username"]',
        css: '#username',
        placeholder: 'Enter username',
        aria: 'Username field',
        text: '',
        dataAttrs: { testid: 'user-input' },
        classes: ['input-field', 'primary'],
        pageUrl: 'http://localhost/test',
        bounding: { x: 100, y: 100, width: 200, height: 30 }
      });

      const result = validateBundle(bundle);

      expect(result.valid).toBe(true);
      expect(result.qualityScore).toBeGreaterThan(70);
      expect(result.issues.filter(i => i.severity === 'error')).toHaveLength(0);
    });

    it('should report error for missing tag', () => {
      const bundle = createEmptyBundle();
      bundle.tag = '';
      bundle.id = 'test';

      const result = validateBundle(bundle);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.code === VALIDATION_CODES.MISSING_TAG)).toBe(true);
    });

    it('should report error for missing locator', () => {
      const bundle = createEmptyBundle();
      bundle.tag = 'input';
      bundle.xpath = '';
      bundle.id = '';
      bundle.css = '';

      const result = validateBundle(bundle);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.code === VALIDATION_CODES.MISSING_LOCATOR)).toBe(true);
    });

    it('should report warning for no unique ID', () => {
      const bundle = createBundle({
        tag: 'input',
        xpath: '//input[1]'
      });

      const result = validateBundle(bundle);

      expect(result.issues.some(i => i.code === VALIDATION_CODES.NO_UNIQUE_ID)).toBe(true);
    });

    it('should report info for iframe context', () => {
      const bundle = createBundle({
        tag: 'input',
        id: 'test',
        iframeChain: [0, 1]
      });

      const result = validateBundle(bundle);

      expect(result.issues.some(i => i.code === VALIDATION_CODES.IFRAME_CONTEXT)).toBe(true);
    });

    it('should report info for shadow DOM context', () => {
      const bundle = createBundle({
        tag: 'input',
        id: 'test',
        shadowHosts: ['custom-element']
      });

      const result = validateBundle(bundle);

      expect(result.issues.some(i => i.code === VALIDATION_CODES.SHADOW_DOM_CONTEXT)).toBe(true);
    });

    it('should return available strategies', () => {
      const bundle = createBundle({
        tag: 'input',
        id: 'username',
        name: 'username',
        xpath: '//*[@id="username"]'
      });

      const result = validateBundle(bundle);

      expect(result.availableStrategies).toContain('xpath');
      expect(result.availableStrategies).toContain('id');
      expect(result.availableStrategies).toContain('name');
    });

    it('should recommend best strategy', () => {
      const bundle = createBundle({
        tag: 'input',
        xpath: '//*[@id="test"]',
        id: 'test'
      });

      const result = validateBundle(bundle);

      expect(result.recommendedStrategy).toBe('xpath');
    });

    it('should calculate stats', () => {
      const bundle = createBundle({
        tag: 'input',
        id: 'username',
        xpath: '//*[@id="username"]'
      });

      const result = validateBundle(bundle);

      expect(result.stats.populatedProperties).toBeGreaterThan(0);
      expect(result.stats.totalProperties).toBe(12);
      expect(result.stats.completeness).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // VERIFY ELEMENT MATCH
  // ==========================================================================

  describe('verifyElementMatch', () => {
    it('should match element with bundle', () => {
      const element = document.getElementById('username')!;
      const bundle = createBundle({
        tag: 'input',
        id: 'username',
        name: 'username',
        placeholder: 'Enter username'
      });

      const result = verifyElementMatch(element, bundle);

      expect(result.matches).toBe(true);
      expect(result.confidence).toBeGreaterThan(70);
    });

    it('should not match different element', () => {
      const element = document.getElementById('password')!;
      const bundle = createBundle({
        tag: 'input',
        id: 'username',
        name: 'username'
      });

      const result = verifyElementMatch(element, bundle);

      expect(result.matches).toBe(false);
      expect(result.confidence).toBeLessThan(70);
    });

    it('should match on tag only', () => {
      const element = document.getElementById('username')!;
      const bundle = createBundle({
        tag: 'input'
      });

      const result = verifyElementMatch(element, bundle);

      expect(result.propertyMatches.find(p => p.property === 'tag')?.matches).toBe(true);
    });

    it('should return property matches', () => {
      const element = document.getElementById('username')!;
      const bundle = createBundle({
        tag: 'input',
        id: 'username',
        name: 'username'
      });

      const result = verifyElementMatch(element, bundle);

      expect(result.propertyMatches.length).toBeGreaterThan(0);
      expect(result.propertyMatches.every(p => 'matches' in p)).toBe(true);
    });

    it('should match fuzzy text', () => {
      const element = document.getElementById('submit-btn')!;
      const bundle = createBundle({
        tag: 'button',
        text: 'Log In'
      });

      const result = verifyElementMatch(element, bundle);

      const textMatch = result.propertyMatches.find(p => p.property === 'text');
      expect(textMatch?.matches).toBe(true);
    });
  });

  // ==========================================================================
  // FIND MATCHING ELEMENTS
  // ==========================================================================

  describe('findMatchingElements', () => {
    it('should find matching elements', () => {
      const bundle = createBundle({
        tag: 'input'
      });

      const matches = findMatchingElements(bundle, document);

      expect(matches.length).toBeGreaterThan(0);
    });

    it('should sort by confidence', () => {
      const bundle = createBundle({
        tag: 'input',
        id: 'username'
      });

      const matches = findMatchingElements(bundle, document);

      if (matches.length > 1) {
        expect(matches[0].confidence).toBeGreaterThanOrEqual(matches[1].confidence);
      }
    });

    it('should return empty array for no matches', () => {
      const bundle = createBundle({
        tag: 'table'
      });

      const matches = findMatchingElements(bundle, document);

      expect(matches).toHaveLength(0);
    });
  });

  // ==========================================================================
  // DIAGNOSTIC REPORT
  // ==========================================================================

  describe('generateDiagnosticReport', () => {
    it('should generate report', () => {
      const bundle = createBundle({
        tag: 'input',
        id: 'username',
        pageUrl: 'http://localhost/test'
      });

      const report = generateDiagnosticReport(bundle, document);

      expect(report.bundle).toBe(bundle);
      expect(report.validation).toBeDefined();
      expect(report.pageContext).toBeDefined();
      expect(report.generatedAt).toBeGreaterThan(0);
    });

    it('should include page context', () => {
      const bundle = createBundle({
        tag: 'input',
        id: 'username'
      });

      const report = generateDiagnosticReport(bundle, document);

      expect(report.pageContext.url).toContain('localhost');
      expect(typeof report.pageContext.similarElementCount).toBe('number');
    });

    it('should provide suggestions', () => {
      const bundle = createEmptyBundle();
      bundle.tag = 'input';
      bundle.xpath = '//input[1]';

      const report = generateDiagnosticReport(bundle, document);

      expect(report.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('formatDiagnosticReport', () => {
    it('should format report as string', () => {
      const bundle = createBundle({
        tag: 'input',
        id: 'username'
      });
      const report = generateDiagnosticReport(bundle, document);

      const formatted = formatDiagnosticReport(report);

      expect(typeof formatted).toBe('string');
      expect(formatted).toContain('DIAGNOSTIC REPORT');
      expect(formatted).toContain('Quality Score');
    });

    it('should include issues', () => {
      const bundle = createEmptyBundle();
      bundle.tag = 'input';
      bundle.xpath = '//input';

      const report = generateDiagnosticReport(bundle, document);
      const formatted = formatDiagnosticReport(report);

      expect(formatted).toContain('Issues');
    });
  });

  // ==========================================================================
  // UTILITY FUNCTIONS
  // ==========================================================================

  describe('isValidBundle', () => {
    it('should return true for valid bundle', () => {
      const bundle = createBundle({
        tag: 'input',
        id: 'test'
      });

      expect(isValidBundle(bundle)).toBe(true);
    });

    it('should return false for invalid bundle', () => {
      const bundle = createEmptyBundle();
      bundle.tag = '';

      expect(isValidBundle(bundle)).toBe(false);
    });
  });

  describe('getQualityLevel', () => {
    it('should return excellent for high score', () => {
      const result = getQualityLevel(85);
      expect(result.level).toBe('excellent');
    });

    it('should return good for medium-high score', () => {
      const result = getQualityLevel(65);
      expect(result.level).toBe('good');
    });

    it('should return fair for medium score', () => {
      const result = getQualityLevel(45);
      expect(result.level).toBe('fair');
    });

    it('should return poor for low score', () => {
      const result = getQualityLevel(25);
      expect(result.level).toBe('poor');
    });
  });

  // ==========================================================================
  // VALIDATION CODES
  // ==========================================================================

  describe('VALIDATION_CODES', () => {
    it('should have all error codes', () => {
      expect(VALIDATION_CODES.MISSING_TAG).toBeDefined();
      expect(VALIDATION_CODES.MISSING_LOCATOR).toBeDefined();
      expect(VALIDATION_CODES.INVALID_XPATH).toBeDefined();
      expect(VALIDATION_CODES.INVALID_CSS).toBeDefined();
    });

    it('should have all warning codes', () => {
      expect(VALIDATION_CODES.NO_UNIQUE_ID).toBeDefined();
      expect(VALIDATION_CODES.NO_TEXT_CONTENT).toBeDefined();
      expect(VALIDATION_CODES.WEAK_LOCATORS).toBeDefined();
    });

    it('should have all info codes', () => {
      expect(VALIDATION_CODES.IFRAME_CONTEXT).toBeDefined();
      expect(VALIDATION_CODES.SHADOW_DOM_CONTEXT).toBeDefined();
    });
  });
});
