/**
 * End-to-End Recording and Replay Flow Tests
 * @module tests/integration/e2e/recording-replay-flow.test
 * @version 1.0.0
 * 
 * Integration tests for the complete recording → replay workflow.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RecordingEngine } from '@/core/recording/RecordingEngine';
import { ReplayEngine } from '@/core/replay/ReplayEngine';
import type { RecordedEvent, Step, StepResult } from '@/core/types';

// ============================================================================
// TEST HELPERS
// ============================================================================

function recordedEventToStep(event: RecordedEvent, index: number): Step {
  return {
    id: `step-${index}`,
    name: `Step ${index + 1}: ${event.eventType} on ${event.label || event.bundle.tag}`,
    event: event.eventType as Step['event'],
    path: event.bundle.xpath,
    value: event.value || '',
    label: event.label,
    x: event.x,
    y: event.y,
    bundle: event.bundle,
  };
}

// ============================================================================
// TEST SETUP
// ============================================================================

describe('Recording and Replay E2E Flow', () => {
  let recordingEngine: RecordingEngine;
  let replayEngine: ReplayEngine;
  let container: HTMLDivElement;
  let capturedEvents: RecordedEvent[];

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);

    capturedEvents = [];

    recordingEngine = new RecordingEngine({
      onEvent: (event) => {
        capturedEvents.push(event);
      },
    });

    replayEngine = new ReplayEngine({
      timeout: 2000,
      retryInterval: 100,
    });
  });

  afterEach(() => {
    recordingEngine.stop();
    document.body.innerHTML = '';
    capturedEvents = [];
    vi.clearAllMocks();
  });

  // ==========================================================================
  // LOGIN FORM FLOW
  // ==========================================================================

  describe('login form flow', () => {
    beforeEach(() => {
      container.innerHTML = `
        <form id="login-form">
          <div class="form-group">
            <label for="username">Username</label>
            <input type="text" id="username" name="username" placeholder="Enter username">
          </div>
          <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" name="password" placeholder="Enter password">
          </div>
          <button type="submit" id="login-btn">Login</button>
        </form>
      `;
    });

    it('should record and replay login form interaction', async () => {
      // ===== RECORDING PHASE =====
      recordingEngine.start();

      // Enter username
      const usernameInput = document.getElementById('username') as HTMLInputElement;
      usernameInput.focus();
      usernameInput.value = 'testuser';
      usernameInput.dispatchEvent(new Event('input', { bubbles: true }));

      // Enter password
      const passwordInput = document.getElementById('password') as HTMLInputElement;
      passwordInput.focus();
      passwordInput.value = 'password123';
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));

      // Click login button
      const loginBtn = document.getElementById('login-btn')!;
      loginBtn.click();

      recordingEngine.stop();

      // Wait for all events to be captured
      await vi.waitFor(() => expect(capturedEvents.length).toBeGreaterThanOrEqual(3));

      // ===== CONVERT TO STEPS =====
      const steps = capturedEvents.map(recordedEventToStep);

      // ===== RESET FORM =====
      usernameInput.value = '';
      passwordInput.value = '';

      // ===== REPLAY PHASE =====
      let loginClicked = false;
      loginBtn.addEventListener('click', () => {
        loginClicked = true;
      });

      const results: StepResult[] = [];
      for (const step of steps) {
        const result = await replayEngine.executeStep(step);
        results.push(result);
      }

      // ===== VERIFY =====
      expect(results.every(r => r.success)).toBe(true);
      expect(usernameInput.value).toBe('testuser');
      expect(passwordInput.value).toBe('password123');
      expect(loginClicked).toBe(true);
    });
  });

  // ==========================================================================
  // SEARCH FLOW
  // ==========================================================================

  describe('search flow', () => {
    beforeEach(() => {
      container.innerHTML = `
        <div class="search-container">
          <input 
            type="text" 
            id="search-input" 
            placeholder="Search..."
            aria-label="Search query"
          >
          <button id="search-btn" type="button">Search</button>
        </div>
        <div id="results"></div>
      `;
    });

    it('should record and replay search interaction', async () => {
      // ===== RECORDING =====
      recordingEngine.start();

      const searchInput = document.getElementById('search-input') as HTMLInputElement;
      searchInput.focus();
      searchInput.value = 'test query';
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));

      const searchBtn = document.getElementById('search-btn')!;
      searchBtn.click();

      recordingEngine.stop();

      await vi.waitFor(() => expect(capturedEvents.length).toBeGreaterThanOrEqual(2));

      // ===== CONVERT AND RESET =====
      const steps = capturedEvents.map(recordedEventToStep);
      searchInput.value = '';

      // ===== REPLAY =====
      let searchClicked = false;
      searchBtn.addEventListener('click', () => {
        searchClicked = true;
      });

      for (const step of steps) {
        await replayEngine.executeStep(step);
      }

      // ===== VERIFY =====
      expect(searchInput.value).toBe('test query');
      expect(searchClicked).toBe(true);
    });
  });

  // ==========================================================================
  // MULTI-STEP FORM FLOW
  // ==========================================================================

  describe('multi-step form flow', () => {
    beforeEach(() => {
      container.innerHTML = `
        <form id="registration-form">
          <div class="step" id="step1">
            <label for="email">Email</label>
            <input type="email" id="email" name="email">
            
            <label for="phone">Phone</label>
            <input type="tel" id="phone" name="phone">
          </div>
          
          <div class="step" id="step2">
            <label for="country">Country</label>
            <select id="country" name="country">
              <option value="">Select...</option>
              <option value="us">United States</option>
              <option value="uk">United Kingdom</option>
              <option value="ca">Canada</option>
            </select>
            
            <label for="terms">
              <input type="checkbox" id="terms" name="terms">
              I agree to terms
            </label>
          </div>
          
          <button type="submit" id="submit-btn">Register</button>
        </form>
      `;
    });

    it('should record and replay complex form with multiple field types', async () => {
      // ===== RECORDING =====
      recordingEngine.start();

      // Fill email
      const emailInput = document.getElementById('email') as HTMLInputElement;
      emailInput.value = 'test@example.com';
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));

      // Fill phone
      const phoneInput = document.getElementById('phone') as HTMLInputElement;
      phoneInput.value = '555-1234';
      phoneInput.dispatchEvent(new Event('input', { bubbles: true }));

      // Select country
      const countrySelect = document.getElementById('country') as HTMLSelectElement;
      countrySelect.value = 'ca';
      countrySelect.dispatchEvent(new Event('change', { bubbles: true }));

      // Check terms
      const termsCheckbox = document.getElementById('terms') as HTMLInputElement;
      termsCheckbox.checked = true;
      termsCheckbox.dispatchEvent(new Event('change', { bubbles: true }));

      // Submit
      const submitBtn = document.getElementById('submit-btn')!;
      submitBtn.click();

      recordingEngine.stop();

      await vi.waitFor(() => expect(capturedEvents.length).toBeGreaterThanOrEqual(5));

      // ===== CONVERT AND RESET =====
      const steps = capturedEvents.map(recordedEventToStep);
      
      emailInput.value = '';
      phoneInput.value = '';
      countrySelect.value = '';
      termsCheckbox.checked = false;

      // ===== REPLAY =====
      const results: StepResult[] = [];
      for (const step of steps) {
        const result = await replayEngine.executeStep(step);
        results.push(result);
      }

      // ===== VERIFY =====
      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBeGreaterThanOrEqual(4); // At least 4 should succeed

      expect(emailInput.value).toBe('test@example.com');
      expect(phoneInput.value).toBe('555-1234');
      expect(countrySelect.value).toBe('ca');
    });
  });

  // ==========================================================================
  // DOM CHANGES BETWEEN RECORD AND REPLAY
  // ==========================================================================

  describe('DOM changes resilience', () => {
    it('should find elements even when DOM structure changes', async () => {
      // Initial structure
      container.innerHTML = `
        <div class="wrapper">
          <input type="text" id="field1" placeholder="Enter value">
        </div>
      `;

      // ===== RECORD =====
      recordingEngine.start();

      const input = document.getElementById('field1') as HTMLInputElement;
      input.value = 'recorded value';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      recordingEngine.stop();

      await vi.waitFor(() => expect(capturedEvents).toHaveLength(1));

      const steps = capturedEvents.map(recordedEventToStep);

      // ===== CHANGE DOM STRUCTURE =====
      container.innerHTML = `
        <div class="new-wrapper">
          <div class="inner">
            <input type="text" id="field1" placeholder="Enter value">
          </div>
        </div>
      `;

      // ===== REPLAY =====
      const result = await replayEngine.executeStep(steps[0]);

      // Should still find by ID even though XPath changed
      expect(result.success).toBe(true);
      
      const newInput = document.getElementById('field1') as HTMLInputElement;
      expect(newInput.value).toBe('recorded value');
    });

    it('should use fallback strategies when primary locator fails', async () => {
      container.innerHTML = `
        <input type="text" id="original-id" placeholder="Unique placeholder text">
      `;

      // ===== RECORD =====
      recordingEngine.start();

      const input = document.getElementById('original-id') as HTMLInputElement;
      input.value = 'test';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      recordingEngine.stop();

      await vi.waitFor(() => expect(capturedEvents).toHaveLength(1));

      const steps = capturedEvents.map(recordedEventToStep);

      // ===== CHANGE ID =====
      container.innerHTML = `
        <input type="text" id="different-id" placeholder="Unique placeholder text">
      `;

      // ===== REPLAY =====
      const result = await replayEngine.executeStep(steps[0]);

      // Should find by placeholder fallback
      expect(result.success).toBe(true);
      
      const newInput = document.getElementById('different-id') as HTMLInputElement;
      expect(newInput.value).toBe('test');
    });
  });

  // ==========================================================================
  // BUNDLE INTEGRITY
  // ==========================================================================

  describe('bundle integrity', () => {
    it('should preserve all bundle data through record → replay', async () => {
      container.innerHTML = `
        <input 
          type="email"
          id="email-field"
          name="email"
          class="form-control required"
          placeholder="Enter email"
          aria-label="Email address"
          data-testid="email-input"
          data-validation="email"
          title="Your email address"
        >
      `;

      // ===== RECORD =====
      recordingEngine.start();

      const input = document.getElementById('email-field') as HTMLInputElement;
      input.value = 'test@test.com';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      recordingEngine.stop();

      await vi.waitFor(() => expect(capturedEvents).toHaveLength(1));

      // ===== VERIFY BUNDLE =====
      const bundle = capturedEvents[0].bundle;

      expect(bundle.id).toBe('email-field');
      expect(bundle.name).toBe('email');
      expect(bundle.placeholder).toBe('Enter email');
      expect(bundle.aria).toBe('Email address');
      expect(bundle.title).toBe('Your email address');
      expect(bundle.classes).toContain('form-control');
      expect(bundle.classes).toContain('required');
      expect(bundle.dataAttrs.testid).toBe('email-input');
      expect(bundle.dataAttrs.validation).toBe('email');
      expect(bundle.tag).toBe('INPUT');
      expect(bundle.xpath).toBeDefined();
      expect(bundle.bounding).toBeDefined();

      // ===== REPLAY =====
      const step = recordedEventToStep(capturedEvents[0], 0);
      input.value = '';

      const result = await replayEngine.executeStep(step);

      expect(result.success).toBe(true);
      expect(input.value).toBe('test@test.com');
    });
  });
});
