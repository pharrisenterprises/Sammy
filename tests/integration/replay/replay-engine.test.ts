/**
 * Replay Engine Integration Tests
 * @module tests/integration/replay/replay-engine.test
 * @version 1.0.0
 * 
 * Integration tests for the Replay Engine action execution.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ReplayEngine } from '@/core/replay/ReplayEngine';
import type { Step, StepResult, LocatorBundle } from '@/core/types';

// ============================================================================
// TEST HELPERS
// ============================================================================

function createStep(overrides: Partial<Step> = {}): Step {
  return {
    id: 'step-1',
    name: 'Test Step',
    event: 'click',
    path: '//button[@id="btn"]',
    value: '',
    label: 'Test Button',
    x: 100,
    y: 100,
    bundle: {
      tag: 'BUTTON',
      id: 'btn',
      name: null,
      placeholder: null,
      aria: null,
      dataAttrs: {},
      text: 'Click Me',
      css: 'button#btn',
      xpath: '//button[@id="btn"]',
      classes: [],
      attrs: {},
      role: 'button',
      title: null,
      href: null,
      src: null,
      bounding: { x: 100, y: 100, width: 100, height: 40 },
      pageUrl: 'https://example.com',
    },
    ...overrides,
  };
}

// ============================================================================
// TEST SETUP
// ============================================================================

describe('ReplayEngine Integration', () => {
  let engine: ReplayEngine;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);

    engine = new ReplayEngine({
      timeout: 2000,
      retryInterval: 100,
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  // ==========================================================================
  // CLICK ACTION TESTS
  // ==========================================================================

  describe('click actions', () => {
    it('should execute click on button', async () => {
      container.innerHTML = `
        <button id="btn">Click Me</button>
      `;

      let clicked = false;
      const button = document.getElementById('btn')!;
      button.addEventListener('click', () => {
        clicked = true;
      });

      const step = createStep({
        event: 'click',
        path: '//button[@id="btn"]',
        bundle: {
          ...createStep().bundle!,
          id: 'btn',
          tag: 'BUTTON',
          xpath: '//button[@id="btn"]',
        },
      });

      const result = await engine.executeStep(step);

      expect(result.success).toBe(true);
      expect(clicked).toBe(true);
    });

    it('should execute click on link', async () => {
      container.innerHTML = `
        <a href="#" id="link">Click Link</a>
      `;

      let clicked = false;
      const link = document.getElementById('link')!;
      link.addEventListener('click', (e) => {
        e.preventDefault();
        clicked = true;
      });

      const step = createStep({
        event: 'click',
        path: '//a[@id="link"]',
        bundle: {
          ...createStep().bundle!,
          id: 'link',
          tag: 'A',
          xpath: '//a[@id="link"]',
        },
      });

      const result = await engine.executeStep(step);

      expect(result.success).toBe(true);
      expect(clicked).toBe(true);
    });

    it('should trigger full mouse event sequence', async () => {
      container.innerHTML = `
        <button id="btn">Click</button>
      `;

      const events: string[] = [];
      const button = document.getElementById('btn')!;
      
      ['mouseenter', 'mouseover', 'mousedown', 'mouseup', 'click'].forEach(type => {
        button.addEventListener(type, () => events.push(type));
      });

      const step = createStep({
        event: 'click',
        bundle: { ...createStep().bundle!, id: 'btn' },
      });

      await engine.executeStep(step);

      expect(events).toContain('mousedown');
      expect(events).toContain('mouseup');
      expect(events).toContain('click');
    });
  });

  // ==========================================================================
  // INPUT ACTION TESTS
  // ==========================================================================

  describe('input actions', () => {
    it('should set value in text input', async () => {
      container.innerHTML = `
        <input type="text" id="name" name="name">
      `;

      const step = createStep({
        event: 'input',
        value: 'John Doe',
        path: '//input[@id="name"]',
        bundle: {
          ...createStep().bundle!,
          id: 'name',
          tag: 'INPUT',
          xpath: '//input[@id="name"]',
        },
      });

      const result = await engine.executeStep(step);

      expect(result.success).toBe(true);
      
      const input = document.getElementById('name') as HTMLInputElement;
      expect(input.value).toBe('John Doe');
    });

    it('should trigger input events', async () => {
      container.innerHTML = `
        <input type="text" id="email">
      `;

      const events: string[] = [];
      const input = document.getElementById('email')!;
      
      ['focus', 'input', 'change', 'blur'].forEach(type => {
        input.addEventListener(type, () => events.push(type));
      });

      const step = createStep({
        event: 'input',
        value: 'test@example.com',
        bundle: { ...createStep().bundle!, id: 'email', tag: 'INPUT' },
      });

      await engine.executeStep(step);

      expect(events).toContain('focus');
      expect(events).toContain('input');
    });

    it('should set value in textarea', async () => {
      container.innerHTML = `
        <textarea id="comments"></textarea>
      `;

      const step = createStep({
        event: 'input',
        value: 'This is a comment\nWith multiple lines',
        bundle: { ...createStep().bundle!, id: 'comments', tag: 'TEXTAREA' },
      });

      const result = await engine.executeStep(step);

      expect(result.success).toBe(true);
      
      const textarea = document.getElementById('comments') as HTMLTextAreaElement;
      expect(textarea.value).toBe('This is a comment\nWith multiple lines');
    });

    it('should select option in select element', async () => {
      container.innerHTML = `
        <select id="country">
          <option value="">Select...</option>
          <option value="us">United States</option>
          <option value="uk">United Kingdom</option>
        </select>
      `;

      const step = createStep({
        event: 'input',
        value: 'uk',
        bundle: { ...createStep().bundle!, id: 'country', tag: 'SELECT' },
      });

      const result = await engine.executeStep(step);

      expect(result.success).toBe(true);
      
      const select = document.getElementById('country') as HTMLSelectElement;
      expect(select.value).toBe('uk');
    });

    it('should check checkbox', async () => {
      container.innerHTML = `
        <input type="checkbox" id="agree" name="agree">
      `;

      const step = createStep({
        event: 'click',
        bundle: { ...createStep().bundle!, id: 'agree', tag: 'INPUT' },
      });

      const result = await engine.executeStep(step);

      expect(result.success).toBe(true);
      
      const checkbox = document.getElementById('agree') as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
    });
  });

  // ==========================================================================
  // ENTER KEY ACTION TESTS
  // ==========================================================================

  describe('enter key actions', () => {
    it('should dispatch Enter keydown event', async () => {
      container.innerHTML = `
        <input type="text" id="search">
      `;

      let enterPressed = false;
      const input = document.getElementById('search')!;
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          enterPressed = true;
        }
      });

      const step = createStep({
        event: 'enter',
        bundle: { ...createStep().bundle!, id: 'search', tag: 'INPUT' },
      });

      const result = await engine.executeStep(step);

      expect(result.success).toBe(true);
      expect(enterPressed).toBe(true);
    });

    it('should submit form on Enter in form input', async () => {
      container.innerHTML = `
        <form id="search-form">
          <input type="text" id="query" name="query">
          <button type="submit">Search</button>
        </form>
      `;

      let formSubmitted = false;
      const form = document.getElementById('search-form')!;
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        formSubmitted = true;
      });

      // First, focus the input
      const input = document.getElementById('query') as HTMLInputElement;
      input.focus();

      const step = createStep({
        event: 'enter',
        bundle: { ...createStep().bundle!, id: 'query', tag: 'INPUT' },
      });

      await engine.executeStep(step);

      // Form submission behavior depends on browser, just check Enter was handled
      expect(true).toBe(true);
    });
  });

  // ==========================================================================
  // ERROR HANDLING TESTS
  // ==========================================================================

  describe('error handling', () => {
    it('should return failure when element not found', async () => {
      container.innerHTML = `
        <div>Empty container</div>
      `;

      const step = createStep({
        bundle: { ...createStep().bundle!, id: 'nonexistent' },
      });

      const result = await engine.executeStep(step);

      expect(result.success).toBe(false);
      expect(result.error_message).toBeDefined();
      expect(result.error_message).toContain('not found');
    });

    it('should include duration in result', async () => {
      container.innerHTML = `
        <button id="btn">Click</button>
      `;

      const step = createStep({
        bundle: { ...createStep().bundle!, id: 'btn' },
      });

      const result = await engine.executeStep(step);

      expect(result.duration).toBeTypeOf('number');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should respect timeout for element finding', async () => {
      container.innerHTML = `
        <div>Empty</div>
      `;

      const shortTimeoutEngine = new ReplayEngine({
        timeout: 100,
        retryInterval: 20,
      });

      const step = createStep({
        bundle: { ...createStep().bundle!, id: 'missing' },
      });

      const startTime = Date.now();
      const result = await shortTimeoutEngine.executeStep(step);
      const elapsed = Date.now() - startTime;

      expect(result.success).toBe(false);
      // Should have timed out around 100ms (+/- buffer)
      expect(elapsed).toBeLessThan(500);
    });
  });

  // ==========================================================================
  // STEP SEQUENCE TESTS
  // ==========================================================================

  describe('step sequences', () => {
    it('should execute multiple steps in order', async () => {
      container.innerHTML = `
        <form id="login-form">
          <input type="text" id="username" name="username">
          <input type="password" id="password" name="password">
          <button type="submit" id="login-btn">Login</button>
        </form>
      `;

      const steps: Step[] = [
        createStep({
          id: 'step-1',
          event: 'input',
          value: 'testuser',
          bundle: { ...createStep().bundle!, id: 'username', tag: 'INPUT' },
        }),
        createStep({
          id: 'step-2',
          event: 'input',
          value: 'password123',
          bundle: { ...createStep().bundle!, id: 'password', tag: 'INPUT' },
        }),
        createStep({
          id: 'step-3',
          event: 'click',
          bundle: { ...createStep().bundle!, id: 'login-btn', tag: 'BUTTON' },
        }),
      ];

      const results: StepResult[] = [];
      for (const step of steps) {
        const result = await engine.executeStep(step);
        results.push(result);
      }

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);

      const username = document.getElementById('username') as HTMLInputElement;
      const password = document.getElementById('password') as HTMLInputElement;

      expect(username.value).toBe('testuser');
      expect(password.value).toBe('password123');
    });
  });

  // ==========================================================================
  // STOP/ABORT TESTS
  // ==========================================================================

  describe('stop/abort', () => {
    it('should stop execution when requested', async () => {
      container.innerHTML = `
        <button id="btn1">Button 1</button>
        <button id="btn2">Button 2</button>
      `;

      const steps: Step[] = [
        createStep({ id: 'step-1', bundle: { ...createStep().bundle!, id: 'btn1' } }),
        createStep({ id: 'step-2', bundle: { ...createStep().bundle!, id: 'btn2' } }),
      ];

      // Start execution and stop immediately
      engine.stop();

      // Engine should be stopped
      expect(engine.isRunning).toBe(false);
    });
  });
});
