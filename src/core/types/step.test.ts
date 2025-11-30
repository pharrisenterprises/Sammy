/**
 * @fileoverview Tests for Step type definitions
 * @module core/types/step.test
 */

import { describe, it, expect } from 'vitest';
import {
  type Step,
  type StepEvent,
  type CreateStepInput,
  STEP_EVENTS,
  STEP_EVENT_LABELS,
  STEP_EVENT_ICONS,
  isStepEvent,
  isStep,
  hasBundle,
  isInputStep,
  isNavigationStep,
  generateStepId,
  generateStepName,
  createStep,
  toStepDisplayInfo,
  validateStep,
  isValidStep,
  cloneStep,
  getMappableSteps,
  getStepById,
  updateStepInArray,
  removeStepFromArray,
  reorderSteps
} from './step';

describe('Step Types', () => {
  // ==========================================================================
  // CONSTANTS
  // ==========================================================================

  describe('STEP_EVENTS', () => {
    it('should contain exactly 4 valid events', () => {
      expect(STEP_EVENTS).toHaveLength(4);
      expect(STEP_EVENTS).toContain('click');
      expect(STEP_EVENTS).toContain('input');
      expect(STEP_EVENTS).toContain('enter');
      expect(STEP_EVENTS).toContain('open');
    });

    it('should NOT contain invalid events', () => {
      expect(STEP_EVENTS).not.toContain('submit');
      expect(STEP_EVENTS).not.toContain('change');
      expect(STEP_EVENTS).not.toContain('keydown');
      expect(STEP_EVENTS).not.toContain('keyup');
      expect(STEP_EVENTS).not.toContain('focus');
      expect(STEP_EVENTS).not.toContain('blur');
      expect(STEP_EVENTS).not.toContain('navigate');
    });
  });

  describe('STEP_EVENT_LABELS', () => {
    it('should have labels for all events', () => {
      expect(STEP_EVENT_LABELS.click).toBe('Click');
      expect(STEP_EVENT_LABELS.input).toBe('Type Text');
      expect(STEP_EVENT_LABELS.enter).toBe('Press Enter');
      expect(STEP_EVENT_LABELS.open).toBe('Open URL');
    });
  });

  describe('STEP_EVENT_ICONS', () => {
    it('should have icons for all events', () => {
      expect(STEP_EVENT_ICONS.click).toBeDefined();
      expect(STEP_EVENT_ICONS.input).toBeDefined();
      expect(STEP_EVENT_ICONS.enter).toBeDefined();
      expect(STEP_EVENT_ICONS.open).toBeDefined();
    });
  });

  // ==========================================================================
  // TYPE GUARDS
  // ==========================================================================

  describe('isStepEvent', () => {
    it('should return true for valid events', () => {
      expect(isStepEvent('click')).toBe(true);
      expect(isStepEvent('input')).toBe(true);
      expect(isStepEvent('enter')).toBe(true);
      expect(isStepEvent('open')).toBe(true);
    });

    it('should return false for invalid events', () => {
      expect(isStepEvent('submit')).toBe(false);
      expect(isStepEvent('change')).toBe(false);
      expect(isStepEvent('keydown')).toBe(false);
      expect(isStepEvent('')).toBe(false);
      expect(isStepEvent(null)).toBe(false);
      expect(isStepEvent(undefined)).toBe(false);
      expect(isStepEvent(123)).toBe(false);
    });
  });

  describe('isStep', () => {
    const validStep: Step = {
      id: 'test-id',
      name: 'Test Step',
      event: 'click',
      path: '/html/body/button',
      value: '',
      label: 'Submit',
      x: 100,
      y: 200
    };

    it('should return true for valid step', () => {
      expect(isStep(validStep)).toBe(true);
    });

    it('should return true for step with bundle', () => {
      const stepWithBundle = { ...validStep, bundle: { tag: 'button' } };
      expect(isStep(stepWithBundle)).toBe(true);
    });

    it('should return false for null/undefined', () => {
      expect(isStep(null)).toBe(false);
      expect(isStep(undefined)).toBe(false);
    });

    it('should return false for missing required fields', () => {
      expect(isStep({ ...validStep, id: '' })).toBe(false);
      expect(isStep({ ...validStep, event: undefined })).toBe(false);
      expect(isStep({ ...validStep, path: 123 })).toBe(false);
    });

    it('should return false for invalid event', () => {
      expect(isStep({ ...validStep, event: 'submit' })).toBe(false);
    });

    it('should return false for invalid bundle type', () => {
      expect(isStep({ ...validStep, bundle: 'not an object' })).toBe(false);
    });
  });

  describe('hasBundle', () => {
    it('should return true if step has bundle', () => {
      const step: Step = {
        id: '1', name: 'Test', event: 'click', path: '/x', value: '', label: '', x: 0, y: 0,
        bundle: { tag: 'button' } as any
      };
      expect(hasBundle(step)).toBe(true);
    });

    it('should return false if step has no bundle', () => {
      const step: Step = {
        id: '1', name: 'Test', event: 'click', path: '/x', value: '', label: '', x: 0, y: 0
      };
      expect(hasBundle(step)).toBe(false);
    });
  });

  describe('isInputStep', () => {
    it('should return true for input events', () => {
      const step: Step = {
        id: '1', name: 'Test', event: 'input', path: '/x', value: 'test', label: '', x: 0, y: 0
      };
      expect(isInputStep(step)).toBe(true);
    });

    it('should return false for other events', () => {
      const step: Step = {
        id: '1', name: 'Test', event: 'click', path: '/x', value: '', label: '', x: 0, y: 0
      };
      expect(isInputStep(step)).toBe(false);
    });
  });

  describe('isNavigationStep', () => {
    it('should return true for open events', () => {
      const step: Step = {
        id: '1', name: 'Test', event: 'open', path: '', value: 'https://example.com', label: '', x: 0, y: 0
      };
      expect(isNavigationStep(step)).toBe(true);
    });

    it('should return false for other events', () => {
      const step: Step = {
        id: '1', name: 'Test', event: 'click', path: '/x', value: '', label: '', x: 0, y: 0
      };
      expect(isNavigationStep(step)).toBe(false);
    });
  });

  // ==========================================================================
  // FACTORY FUNCTIONS
  // ==========================================================================

  describe('generateStepId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateStepId();
      const id2 = generateStepId();
      expect(id1).not.toBe(id2);
    });

    it('should generate non-empty strings', () => {
      const id = generateStepId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });
  });

  describe('generateStepName', () => {
    it('should generate name for click with label', () => {
      expect(generateStepName('click', 'Submit Button')).toBe('Click Submit Button');
    });

    it('should generate name for input with label and value', () => {
      expect(generateStepName('input', 'Username', 'testuser')).toBe('Type Text "testuser" in Username');
    });

    it('should truncate long values', () => {
      const longValue = 'a'.repeat(30);
      const name = generateStepName('input', 'Field', longValue);
      expect(name).toContain('...');
      expect(name.length).toBeLessThan(50);
    });

    it('should generate name for open with URL', () => {
      expect(generateStepName('open', '', 'https://example.com/path')).toBe('Open URL example.com');
    });

    it('should fallback to event label when no label provided', () => {
      expect(generateStepName('click')).toBe('Click');
      expect(generateStepName('enter')).toBe('Press Enter');
    });
  });

  describe('createStep', () => {
    it('should create step with required fields', () => {
      const input: CreateStepInput = {
        event: 'click',
        path: '/html/body/button',
        x: 100,
        y: 200
      };

      const step = createStep(input);

      expect(step.id).toBeDefined();
      expect(step.name).toBeDefined();
      expect(step.event).toBe('click');
      expect(step.path).toBe('/html/body/button');
      expect(step.value).toBe('');
      expect(step.label).toBe('');
      expect(step.x).toBe(100);
      expect(step.y).toBe(200);
    });

    it('should use provided label and value', () => {
      const step = createStep({
        event: 'input',
        path: '/html/body/input',
        x: 0,
        y: 0,
        label: 'Username',
        value: 'testuser'
      });

      expect(step.label).toBe('Username');
      expect(step.value).toBe('testuser');
    });

    it('should include bundle if provided', () => {
      const bundle = { tag: 'button' } as any;
      const step = createStep({
        event: 'click',
        path: '/x',
        x: 0,
        y: 0,
        bundle
      });

      expect(step.bundle).toBe(bundle);
    });
  });

  describe('toStepDisplayInfo', () => {
    it('should convert step to display info', () => {
      const step: Step = {
        id: 'test-id',
        name: 'Click Submit',
        event: 'click',
        path: '/x',
        value: '',
        label: 'Submit',
        x: 0,
        y: 0,
        bundle: { tag: 'button' } as any
      };

      const info = toStepDisplayInfo(step, 5);

      expect(info.id).toBe('test-id');
      expect(info.index).toBe(5);
      expect(info.name).toBe('Click Submit');
      expect(info.event).toBe('click');
      expect(info.eventLabel).toBe('Click');
      expect(info.eventIcon).toBe('🖱️');
      expect(info.label).toBe('Submit');
      expect(info.hasBundle).toBe(true);
    });
  });

  // ==========================================================================
  // VALIDATION
  // ==========================================================================

  describe('validateStep', () => {
    it('should return empty array for valid step', () => {
      const step: Partial<Step> = {
        id: 'test-id',
        event: 'click',
        path: '/html/body/button',
        x: 100,
        y: 200
      };
      expect(validateStep(step)).toEqual([]);
    });

    it('should return error for missing id', () => {
      const errors = validateStep({ event: 'click', path: '/x', x: 0, y: 0 });
      expect(errors.some(e => e.field === 'id')).toBe(true);
    });

    it('should return error for invalid event', () => {
      const errors = validateStep({ id: '1', event: 'submit' as StepEvent, path: '/x', x: 0, y: 0 });
      expect(errors.some(e => e.field === 'event')).toBe(true);
    });

    it('should return error for missing path on non-open events', () => {
      const errors = validateStep({ id: '1', event: 'click', path: '', x: 0, y: 0 });
      expect(errors.some(e => e.field === 'path')).toBe(true);
    });

    it('should not require path for open events', () => {
      const errors = validateStep({ id: '1', event: 'open', path: '', x: 0, y: 0 });
      expect(errors.some(e => e.field === 'path')).toBe(false);
    });

    it('should return error for invalid coordinates', () => {
      const errors = validateStep({ id: '1', event: 'click', path: '/x', x: NaN, y: 0 });
      expect(errors.some(e => e.field === 'x')).toBe(true);
    });
  });

  describe('isValidStep', () => {
    it('should return true for valid step', () => {
      expect(isValidStep({ id: '1', event: 'click', path: '/x', x: 0, y: 0 })).toBe(true);
    });

    it('should return false for invalid step', () => {
      expect(isValidStep({})).toBe(false);
    });
  });

  // ==========================================================================
  // UTILITY FUNCTIONS
  // ==========================================================================

  describe('cloneStep', () => {
    it('should create a copy with new id', () => {
      const original: Step = {
        id: 'orig-id', name: 'Test', event: 'click', path: '/x', value: '', label: '', x: 0, y: 0
      };
      const cloned = cloneStep(original);

      expect(cloned.id).not.toBe(original.id);
      expect(cloned.name).toBe(original.name);
      expect(cloned.event).toBe(original.event);
    });

    it('should apply overrides', () => {
      const original: Step = {
        id: 'orig-id', name: 'Test', event: 'click', path: '/x', value: '', label: '', x: 0, y: 0
      };
      const cloned = cloneStep(original, { name: 'New Name' });

      expect(cloned.name).toBe('New Name');
    });
  });

  describe('getMappableSteps', () => {
    it('should return only input steps with labels', () => {
      const steps: Step[] = [
        { id: '1', name: 'Click', event: 'click', path: '/x', value: '', label: 'Button', x: 0, y: 0 },
        { id: '2', name: 'Input', event: 'input', path: '/x', value: 'test', label: 'Username', x: 0, y: 0 },
        { id: '3', name: 'Input No Label', event: 'input', path: '/x', value: 'test', label: '', x: 0, y: 0 },
        { id: '4', name: 'Input Label', event: 'input', path: '/x', value: 'test', label: 'Password', x: 0, y: 0 },
      ];

      const mappable = getMappableSteps(steps);

      expect(mappable).toHaveLength(2);
      expect(mappable[0].label).toBe('Username');
      expect(mappable[1].label).toBe('Password');
    });
  });

  describe('getStepById', () => {
    const steps: Step[] = [
      { id: '1', name: 'First', event: 'click', path: '/x', value: '', label: '', x: 0, y: 0 },
      { id: '2', name: 'Second', event: 'click', path: '/x', value: '', label: '', x: 0, y: 0 },
    ];

    it('should find step by id', () => {
      expect(getStepById(steps, '2')?.name).toBe('Second');
    });

    it('should return undefined for non-existent id', () => {
      expect(getStepById(steps, '999')).toBeUndefined();
    });
  });

  describe('updateStepInArray', () => {
    it('should update matching step', () => {
      const steps: Step[] = [
        { id: '1', name: 'First', event: 'click', path: '/x', value: '', label: '', x: 0, y: 0 },
        { id: '2', name: 'Second', event: 'click', path: '/x', value: '', label: '', x: 0, y: 0 },
      ];

      const updated = updateStepInArray(steps, '1', { name: 'Updated' });

      expect(updated[0].name).toBe('Updated');
      expect(updated[1].name).toBe('Second');
      expect(steps[0].name).toBe('First'); // Original unchanged
    });
  });

  describe('removeStepFromArray', () => {
    it('should remove matching step', () => {
      const steps: Step[] = [
        { id: '1', name: 'First', event: 'click', path: '/x', value: '', label: '', x: 0, y: 0 },
        { id: '2', name: 'Second', event: 'click', path: '/x', value: '', label: '', x: 0, y: 0 },
      ];

      const result = removeStepFromArray(steps, '1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('2');
    });
  });

  describe('reorderSteps', () => {
    const steps: Step[] = [
      { id: '1', name: 'First', event: 'click', path: '/x', value: '', label: '', x: 0, y: 0 },
      { id: '2', name: 'Second', event: 'click', path: '/x', value: '', label: '', x: 0, y: 0 },
      { id: '3', name: 'Third', event: 'click', path: '/x', value: '', label: '', x: 0, y: 0 },
    ];

    it('should move step forward', () => {
      const result = reorderSteps(steps, 0, 2);
      expect(result.map(s => s.id)).toEqual(['2', '3', '1']);
    });

    it('should move step backward', () => {
      const result = reorderSteps(steps, 2, 0);
      expect(result.map(s => s.id)).toEqual(['3', '1', '2']);
    });

    it('should return same array for invalid indices', () => {
      expect(reorderSteps(steps, -1, 0)).toBe(steps);
      expect(reorderSteps(steps, 0, 10)).toBe(steps);
      expect(reorderSteps(steps, 1, 1)).toBe(steps);
    });
  });
});
