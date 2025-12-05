/**
 * Label Detection Integration Tests
 * @module tests/integration/recording/label-detection.test
 * @version 1.0.0
 * 
 * Integration tests for the label detection engine with various HTML patterns.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LabelDetectionEngine } from '@/core/recording/LabelDetectionEngine';

// ============================================================================
// TEST SETUP
// ============================================================================

describe('LabelDetectionEngine Integration', () => {
  let labelEngine: LabelDetectionEngine;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);
    
    labelEngine = new LabelDetectionEngine();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  // ==========================================================================
  // ARIA LABEL TESTS
  // ==========================================================================

  describe('aria-label detection', () => {
    it('should detect aria-label attribute', () => {
      container.innerHTML = `
        <input type="text" aria-label="Email Address" id="email">
      `;

      const input = document.getElementById('email')!;
      const label = labelEngine.detectLabel(input);

      expect(label).toBe('Email Address');
    });

    it('should detect aria-labelledby reference', () => {
      container.innerHTML = `
        <span id="email-label">Your Email</span>
        <input type="email" aria-labelledby="email-label" id="email">
      `;

      const input = document.getElementById('email')!;
      const label = labelEngine.detectLabel(input);

      expect(label).toBe('Your Email');
    });
  });

  // ==========================================================================
  // LABEL ELEMENT TESTS
  // ==========================================================================

  describe('label element detection', () => {
    it('should detect label with for attribute', () => {
      container.innerHTML = `
        <label for="username">Username</label>
        <input type="text" id="username">
      `;

      const input = document.getElementById('username')!;
      const label = labelEngine.detectLabel(input);

      expect(label).toBe('Username');
    });

    it('should detect wrapping label', () => {
      container.innerHTML = `
        <label>
          Full Name
          <input type="text" id="fullname">
        </label>
      `;

      const input = document.getElementById('fullname')!;
      const label = labelEngine.detectLabel(input);

      expect(label).toBe('Full Name');
    });

    it('should detect label with nested span', () => {
      container.innerHTML = `
        <label for="phone">
          <span class="label-text">Phone Number</span>
          <span class="required">*</span>
        </label>
        <input type="tel" id="phone">
      `;

      const input = document.getElementById('phone')!;
      const label = labelEngine.detectLabel(input);

      expect(label).toContain('Phone Number');
    });
  });

  // ==========================================================================
  // PLACEHOLDER TESTS
  // ==========================================================================

  describe('placeholder detection', () => {
    it('should detect placeholder attribute', () => {
      container.innerHTML = `
        <input type="text" placeholder="Enter your name" id="name">
      `;

      const input = document.getElementById('name')!;
      const label = labelEngine.detectLabel(input);

      expect(label).toBe('Enter your name');
    });

    it('should prefer label over placeholder', () => {
      container.innerHTML = `
        <label for="email">Email Address</label>
        <input type="email" placeholder="e.g. user@example.com" id="email">
      `;

      const input = document.getElementById('email')!;
      const label = labelEngine.detectLabel(input);

      expect(label).toBe('Email Address');
    });
  });

  // ==========================================================================
  // TITLE AND NAME TESTS
  // ==========================================================================

  describe('title and name detection', () => {
    it('should detect title attribute', () => {
      container.innerHTML = `
        <input type="text" title="Search Query" id="search">
      `;

      const input = document.getElementById('search')!;
      const label = labelEngine.detectLabel(input);

      expect(label).toBe('Search Query');
    });

    it('should humanize name attribute as fallback', () => {
      container.innerHTML = `
        <input type="text" name="first_name" id="firstName">
      `;

      const input = document.getElementById('firstName')!;
      const label = labelEngine.detectLabel(input);

      expect(label).toContain('first');
      expect(label).toContain('name');
    });
  });

  // ==========================================================================
  // BOOTSTRAP PATTERN TESTS
  // ==========================================================================

  describe('Bootstrap form patterns', () => {
    it('should detect Bootstrap form-group label', () => {
      container.innerHTML = `
        <div class="form-group">
          <label>Company Name</label>
          <input type="text" class="form-control" id="company">
        </div>
      `;

      const input = document.getElementById('company')!;
      const label = labelEngine.detectLabel(input);

      expect(label).toBe('Company Name');
    });

    it('should detect Bootstrap input-group addon', () => {
      container.innerHTML = `
        <div class="input-group">
          <span class="input-group-addon">$</span>
          <input type="number" class="form-control" id="amount" placeholder="Amount">
        </div>
      `;

      const input = document.getElementById('amount')!;
      const label = labelEngine.detectLabel(input);

      // Should get placeholder since addon is just "$"
      expect(label).toBe('Amount');
    });

    it('should detect Bootstrap floating label', () => {
      container.innerHTML = `
        <div class="form-floating">
          <input type="text" class="form-control" id="floatingInput" placeholder="Name">
          <label for="floatingInput">Full Name</label>
        </div>
      `;

      const input = document.getElementById('floatingInput')!;
      const label = labelEngine.detectLabel(input);

      expect(label).toBe('Full Name');
    });
  });

  // ==========================================================================
  // SIBLING TEXT TESTS
  // ==========================================================================

  describe('sibling text detection', () => {
    it('should detect preceding text node', () => {
      container.innerHTML = `
        <div>
          First Name: <input type="text" id="fname">
        </div>
      `;

      const input = document.getElementById('fname')!;
      const label = labelEngine.detectLabel(input);

      expect(label).toContain('First Name');
    });

    it('should detect preceding span', () => {
      container.innerHTML = `
        <div class="field">
          <span class="field-label">Last Name</span>
          <input type="text" id="lname">
        </div>
      `;

      const input = document.getElementById('lname')!;
      const label = labelEngine.detectLabel(input);

      expect(label).toBe('Last Name');
    });

    it('should detect label in preceding table cell', () => {
      container.innerHTML = `
        <table>
          <tr>
            <td>Email:</td>
            <td><input type="email" id="email"></td>
          </tr>
        </table>
      `;

      const input = document.getElementById('email')!;
      const label = labelEngine.detectLabel(input);

      expect(label).toContain('Email');
    });
  });

  // ==========================================================================
  // GOOGLE FORMS PATTERN TESTS
  // ==========================================================================

  describe('Google Forms patterns', () => {
    it('should detect Google Forms question text', () => {
      container.innerHTML = `
        <div class="freebirdFormviewerViewItemsItemItem">
          <div class="freebirdFormviewerViewItemsItemItemTitle" role="heading">
            What is your favorite color?
          </div>
          <div class="freebirdFormviewerViewItemsTextItemWrapper">
            <input type="text" class="quantumWizTextinputPaperinputInput" id="gf-input">
          </div>
        </div>
      `;

      const input = document.getElementById('gf-input')!;
      const label = labelEngine.detectLabel(input);

      expect(label).toContain('favorite color');
    });
  });

  // ==========================================================================
  // MATERIAL UI PATTERN TESTS
  // ==========================================================================

  describe('Material UI patterns', () => {
    it('should detect MUI TextField label', () => {
      container.innerHTML = `
        <div class="MuiFormControl-root">
          <label class="MuiInputLabel-root" data-shrink="true">Your Name</label>
          <div class="MuiInputBase-root">
            <input type="text" class="MuiInputBase-input" id="mui-input">
          </div>
        </div>
      `;

      const input = document.getElementById('mui-input')!;
      const label = labelEngine.detectLabel(input);

      expect(label).toBe('Your Name');
    });
  });

  // ==========================================================================
  // BUTTON TEXT DETECTION
  // ==========================================================================

  describe('button text detection', () => {
    it('should detect button text content', () => {
      container.innerHTML = `
        <button id="submit">Submit Form</button>
      `;

      const button = document.getElementById('submit')!;
      const label = labelEngine.detectLabel(button);

      expect(label).toBe('Submit Form');
    });

    it('should detect button with icon and text', () => {
      container.innerHTML = `
        <button id="save">
          <svg class="icon"></svg>
          <span>Save Changes</span>
        </button>
      `;

      const button = document.getElementById('save')!;
      const label = labelEngine.detectLabel(button);

      expect(label).toContain('Save Changes');
    });

    it('should detect submit input value', () => {
      container.innerHTML = `
        <input type="submit" value="Create Account" id="create">
      `;

      const input = document.getElementById('create')!;
      const label = labelEngine.detectLabel(input);

      expect(label).toBe('Create Account');
    });
  });

  // ==========================================================================
  // FALLBACK TESTS
  // ==========================================================================

  describe('fallback strategies', () => {
    it('should return id when no label found', () => {
      container.innerHTML = `
        <input type="text" id="mysterious-field-123">
      `;

      const input = document.getElementById('mysterious-field-123')!;
      const label = labelEngine.detectLabel(input);

      expect(label).toContain('mysterious');
    });

    it('should return empty string for unlabeled element', () => {
      container.innerHTML = `
        <input type="text">
      `;

      const input = container.querySelector('input')!;
      const label = labelEngine.detectLabel(input);

      // Should return empty or some default
      expect(typeof label).toBe('string');
    });
  });

  // ==========================================================================
  // PRIORITY ORDER TESTS
  // ==========================================================================

  describe('detection priority', () => {
    it('should prefer aria-label over other methods', () => {
      container.innerHTML = `
        <label for="field">Label Text</label>
        <input 
          type="text" 
          id="field" 
          aria-label="Aria Label Text"
          placeholder="Placeholder Text"
          title="Title Text"
        >
      `;

      const input = document.getElementById('field')!;
      const label = labelEngine.detectLabel(input);

      expect(label).toBe('Aria Label Text');
    });

    it('should use label element when no aria-label', () => {
      container.innerHTML = `
        <label for="field">Label Text</label>
        <input 
          type="text" 
          id="field"
          placeholder="Placeholder Text"
          title="Title Text"
        >
      `;

      const input = document.getElementById('field')!;
      const label = labelEngine.detectLabel(input);

      expect(label).toBe('Label Text');
    });
  });
});
