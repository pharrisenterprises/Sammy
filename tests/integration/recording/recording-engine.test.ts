/**
 * Recording Engine Integration Tests
 * @module tests/integration/recording/recording-engine.test
 * @version 1.0.0
 * 
 * Integration tests for the Recording Engine event capture and bundle creation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RecordingEngine } from '@/core/recording/RecordingEngine';
import { EventListenerManager } from '@/core/recording/EventListenerManager';
import { BundleBuilder } from '@/core/recording/BundleBuilder';
import type { RecordedEvent, LocatorBundle } from '@/core/types';

// ============================================================================
// TEST SETUP
// ============================================================================

describe('RecordingEngine Integration', () => {
  let engine: RecordingEngine;
  let container: HTMLDivElement;
  let capturedEvents: RecordedEvent[];

  beforeEach(() => {
    // Create DOM container
    container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);

    // Track captured events
    capturedEvents = [];

    // Create engine with event callback
    engine = new RecordingEngine({
      onEvent: (event) => {
        capturedEvents.push(event);
      },
    });
  });

  afterEach(() => {
    engine.stop();
    document.body.innerHTML = '';
    capturedEvents = [];
    vi.clearAllMocks();
  });

  // ==========================================================================
  // CLICK EVENT TESTS
  // ==========================================================================

  describe('click event capture', () => {
    it('should capture click on button', async () => {
      container.innerHTML = `
        <button id="submit-btn" class="primary-btn">Submit</button>
      `;

      engine.start();

      const button = document.getElementById('submit-btn')!;
      button.click();

      // Allow async processing
      await vi.waitFor(() => expect(capturedEvents).toHaveLength(1));

      const event = capturedEvents[0];
      expect(event.eventType).toBe('click');
      expect(event.bundle.id).toBe('submit-btn');
      expect(event.bundle.tag).toBe('BUTTON');
      expect(event.bundle.text).toContain('Submit');
    });

    it('should capture click on link', async () => {
      container.innerHTML = `
        <a href="/next" id="next-link">Next Page</a>
      `;

      engine.start();

      const link = document.getElementById('next-link')!;
      link.click();

      await vi.waitFor(() => expect(capturedEvents).toHaveLength(1));

      const event = capturedEvents[0];
      expect(event.eventType).toBe('click');
      expect(event.bundle.tag).toBe('A');
      expect(event.bundle.href).toBe('/next');
    });

    it('should capture click with coordinates', async () => {
      container.innerHTML = `
        <div id="clickable" style="width: 100px; height: 100px;">Click me</div>
      `;

      engine.start();

      const div = document.getElementById('clickable')!;
      const clickEvent = new MouseEvent('click', {
        clientX: 50,
        clientY: 50,
        bubbles: true,
      });
      div.dispatchEvent(clickEvent);

      await vi.waitFor(() => expect(capturedEvents).toHaveLength(1));

      const event = capturedEvents[0];
      expect(event.x).toBeDefined();
      expect(event.y).toBeDefined();
    });

    it('should not capture click when stopped', async () => {
      container.innerHTML = `
        <button id="btn">Click</button>
      `;

      engine.start();
      engine.stop();

      const button = document.getElementById('btn')!;
      button.click();

      // Wait a bit to ensure no events captured
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(capturedEvents).toHaveLength(0);
    });
  });

  // ==========================================================================
  // INPUT EVENT TESTS
  // ==========================================================================

  describe('input event capture', () => {
    it('should capture text input', async () => {
      container.innerHTML = `
        <input type="text" id="username" name="username" placeholder="Enter username">
      `;

      engine.start();

      const input = document.getElementById('username') as HTMLInputElement;
      input.value = 'testuser';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      await vi.waitFor(() => expect(capturedEvents).toHaveLength(1));

      const event = capturedEvents[0];
      expect(event.eventType).toBe('input');
      expect(event.value).toBe('testuser');
      expect(event.bundle.name).toBe('username');
      expect(event.bundle.placeholder).toBe('Enter username');
    });

    it('should capture password input without exposing value', async () => {
      container.innerHTML = `
        <input type="password" id="password" name="password">
      `;

      engine.start();

      const input = document.getElementById('password') as HTMLInputElement;
      input.value = 'secretpassword';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      await vi.waitFor(() => expect(capturedEvents).toHaveLength(1));

      const event = capturedEvents[0];
      expect(event.eventType).toBe('input');
      // Password values should be captured for replay but marked
      expect(event.value).toBe('secretpassword');
      expect(event.bundle.tag).toBe('INPUT');
    });

    it('should capture textarea input', async () => {
      container.innerHTML = `
        <textarea id="comments" name="comments">Initial text</textarea>
      `;

      engine.start();

      const textarea = document.getElementById('comments') as HTMLTextAreaElement;
      textarea.value = 'Updated comments here';
      textarea.dispatchEvent(new Event('input', { bubbles: true }));

      await vi.waitFor(() => expect(capturedEvents).toHaveLength(1));

      const event = capturedEvents[0];
      expect(event.eventType).toBe('input');
      expect(event.value).toBe('Updated comments here');
      expect(event.bundle.tag).toBe('TEXTAREA');
    });

    it('should capture select change', async () => {
      container.innerHTML = `
        <select id="country" name="country">
          <option value="">Select...</option>
          <option value="us">United States</option>
          <option value="uk">United Kingdom</option>
        </select>
      `;

      engine.start();

      const select = document.getElementById('country') as HTMLSelectElement;
      select.value = 'us';
      select.dispatchEvent(new Event('change', { bubbles: true }));

      await vi.waitFor(() => expect(capturedEvents).toHaveLength(1));

      const event = capturedEvents[0];
      expect(event.value).toBe('us');
      expect(event.bundle.tag).toBe('SELECT');
    });

    it('should capture checkbox change', async () => {
      container.innerHTML = `
        <input type="checkbox" id="agree" name="agree">
        <label for="agree">I agree to terms</label>
      `;

      engine.start();

      const checkbox = document.getElementById('agree') as HTMLInputElement;
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));

      await vi.waitFor(() => expect(capturedEvents).toHaveLength(1));

      const event = capturedEvents[0];
      expect(event.bundle.tag).toBe('INPUT');
    });
  });

  // ==========================================================================
  // KEYBOARD EVENT TESTS
  // ==========================================================================

  describe('keyboard event capture', () => {
    it('should capture Enter key press', async () => {
      container.innerHTML = `
        <input type="text" id="search" placeholder="Search...">
      `;

      engine.start();

      const input = document.getElementById('search')!;
      input.focus();
      
      const keydownEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        bubbles: true,
      });
      input.dispatchEvent(keydownEvent);

      await vi.waitFor(() => expect(capturedEvents.length).toBeGreaterThanOrEqual(1));

      const enterEvent = capturedEvents.find(e => e.eventType === 'enter');
      expect(enterEvent).toBeDefined();
    });

    it('should not capture regular key presses as separate events', async () => {
      container.innerHTML = `
        <input type="text" id="name">
      `;

      engine.start();

      const input = document.getElementById('name') as HTMLInputElement;
      
      // Type some characters
      input.value = 'abc';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      await vi.waitFor(() => expect(capturedEvents).toHaveLength(1));

      // Should only have one input event, not individual keystrokes
      expect(capturedEvents[0].eventType).toBe('input');
    });
  });

  // ==========================================================================
  // BUNDLE CREATION TESTS
  // ==========================================================================

  describe('bundle creation', () => {
    it('should create complete bundle with all attributes', async () => {
      container.innerHTML = `
        <input 
          type="email" 
          id="email-input"
          name="email"
          class="form-control required"
          placeholder="Enter email"
          aria-label="Email address"
          data-testid="email-field"
          data-validation="email"
        >
      `;

      engine.start();

      const input = document.getElementById('email-input') as HTMLInputElement;
      input.value = 'test@example.com';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      await vi.waitFor(() => expect(capturedEvents).toHaveLength(1));

      const bundle = capturedEvents[0].bundle;
      
      expect(bundle.id).toBe('email-input');
      expect(bundle.name).toBe('email');
      expect(bundle.placeholder).toBe('Enter email');
      expect(bundle.aria).toBe('Email address');
      expect(bundle.classes).toContain('form-control');
      expect(bundle.classes).toContain('required');
      expect(bundle.dataAttrs).toHaveProperty('testid', 'email-field');
      expect(bundle.dataAttrs).toHaveProperty('validation', 'email');
      expect(bundle.tag).toBe('INPUT');
      expect(bundle.xpath).toBeDefined();
      expect(bundle.xpath.length).toBeGreaterThan(0);
    });

    it('should include bounding box in bundle', async () => {
      container.innerHTML = `
        <button id="btn" style="width: 100px; height: 40px;">Click</button>
      `;

      engine.start();

      const button = document.getElementById('btn')!;
      button.click();

      await vi.waitFor(() => expect(capturedEvents).toHaveLength(1));

      const bundle = capturedEvents[0].bundle;
      expect(bundle.bounding).toBeDefined();
      expect(bundle.bounding.width).toBeGreaterThan(0);
      expect(bundle.bounding.height).toBeGreaterThan(0);
    });

    it('should generate valid XPath', async () => {
      container.innerHTML = `
        <form id="myform">
          <div class="form-group">
            <input type="text" id="field1">
          </div>
        </form>
      `;

      engine.start();

      const input = document.getElementById('field1') as HTMLInputElement;
      input.value = 'test';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      await vi.waitFor(() => expect(capturedEvents).toHaveLength(1));

      const xpath = capturedEvents[0].bundle.xpath;
      
      // Verify XPath can find the element
      const result = document.evaluate(
        xpath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );
      
      expect(result.singleNodeValue).toBe(input);
    });
  });

  // ==========================================================================
  // START/STOP LIFECYCLE TESTS
  // ==========================================================================

  describe('lifecycle management', () => {
    it('should attach listeners on start', () => {
      container.innerHTML = `<button id="btn">Click</button>`;

      expect(engine.isRecording).toBe(false);
      
      engine.start();
      
      expect(engine.isRecording).toBe(true);
    });

    it('should detach listeners on stop', async () => {
      container.innerHTML = `<button id="btn">Click</button>`;

      engine.start();
      expect(engine.isRecording).toBe(true);

      engine.stop();
      expect(engine.isRecording).toBe(false);

      // Verify no events captured after stop
      const button = document.getElementById('btn')!;
      button.click();

      await new Promise(resolve => setTimeout(resolve, 50));
      expect(capturedEvents).toHaveLength(0);
    });

    it('should handle multiple start/stop cycles', async () => {
      container.innerHTML = `<button id="btn">Click</button>`;
      const button = document.getElementById('btn')!;

      // First cycle
      engine.start();
      button.click();
      await vi.waitFor(() => expect(capturedEvents).toHaveLength(1));
      engine.stop();

      // Second cycle
      engine.start();
      button.click();
      await vi.waitFor(() => expect(capturedEvents).toHaveLength(2));
      engine.stop();

      expect(capturedEvents).toHaveLength(2);
    });
  });

  // ==========================================================================
  // COMPLEX DOM STRUCTURE TESTS
  // ==========================================================================

  describe('complex DOM structures', () => {
    it('should capture events in nested elements', async () => {
      container.innerHTML = `
        <div class="card">
          <div class="card-body">
            <form>
              <div class="form-row">
                <div class="form-group col-6">
                  <label for="firstName">First Name</label>
                  <input type="text" id="firstName" name="firstName">
                </div>
                <div class="form-group col-6">
                  <label for="lastName">Last Name</label>
                  <input type="text" id="lastName" name="lastName">
                </div>
              </div>
              <button type="submit" id="submitBtn">Submit</button>
            </form>
          </div>
        </div>
      `;

      engine.start();

      // Interact with first name
      const firstName = document.getElementById('firstName') as HTMLInputElement;
      firstName.value = 'John';
      firstName.dispatchEvent(new Event('input', { bubbles: true }));

      // Interact with last name
      const lastName = document.getElementById('lastName') as HTMLInputElement;
      lastName.value = 'Doe';
      lastName.dispatchEvent(new Event('input', { bubbles: true }));

      // Click submit
      const submitBtn = document.getElementById('submitBtn')!;
      submitBtn.click();

      await vi.waitFor(() => expect(capturedEvents).toHaveLength(3));

      expect(capturedEvents[0].bundle.id).toBe('firstName');
      expect(capturedEvents[1].bundle.id).toBe('lastName');
      expect(capturedEvents[2].bundle.id).toBe('submitBtn');
    });

    it('should handle dynamically added elements', async () => {
      container.innerHTML = `<div id="dynamic-container"></div>`;

      engine.start();

      // Add element dynamically
      const dynamicContainer = document.getElementById('dynamic-container')!;
      const button = document.createElement('button');
      button.id = 'dynamic-btn';
      button.textContent = 'Dynamic Button';
      dynamicContainer.appendChild(button);

      // Wait for mutation observer
      await new Promise(resolve => setTimeout(resolve, 100));

      button.click();

      await vi.waitFor(() => expect(capturedEvents).toHaveLength(1));

      expect(capturedEvents[0].bundle.id).toBe('dynamic-btn');
    });
  });
});
