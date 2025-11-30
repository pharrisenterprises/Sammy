/**
 * @fileoverview Tests for highlight utilities
 * @module core/locators/highlights.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  HighlightManager,
  STYLE_PRESETS,
  DEFAULT_HIGHLIGHT_CONFIG,
  quickHighlight,
  highlightSuccess,
  highlightError,
  highlightRecording,
  highlightReplay,
  clearAllHighlights,
  removeHighlight,
  highlightBoundingBox,
  flashHighlight,
  getDefaultManager,
  resetDefaultManager,
  removeInjectedStyles,
  scrollAndHighlight,
  ensureVisibleAndHighlight
} from './highlights';

describe('Highlights', () => {
  let dom: JSDOM;
  let document: Document;
  let window: Window;

  beforeEach(() => {
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head></head>
        <body>
          <div id="container">
            <input id="username" type="text">
            <button id="submit-btn">Submit</button>
            <div id="content" style="width: 200px; height: 100px;">Content</div>
          </div>
        </body>
      </html>
    `, { url: 'http://localhost/' });
    
    document = dom.window.document;
    window = dom.window as unknown as Window;
    global.document = document;
    global.window = window as unknown as Window & typeof globalThis;

    // Mock scrollIntoView for JSDOM
    if (typeof dom.window.Element !== 'undefined') {
      dom.window.Element.prototype.scrollIntoView = vi.fn();
    }

    // Reset manager before each test
    resetDefaultManager();
    removeInjectedStyles();
  });

  afterEach(() => {
    resetDefaultManager();
    removeInjectedStyles();
    dom.window.close();
  });

  // ==========================================================================
  // CONSTANTS
  // ==========================================================================

  describe('Constants', () => {
    describe('STYLE_PRESETS', () => {
      it('should have recording preset', () => {
        expect(STYLE_PRESETS.recording).toBeDefined();
        expect(STYLE_PRESETS.recording.borderColor).toBe('#ff6b6b');
      });

      it('should have replay preset', () => {
        expect(STYLE_PRESETS.replay).toBeDefined();
        expect(STYLE_PRESETS.replay.borderColor).toBe('#4dabf7');
      });

      it('should have success preset', () => {
        expect(STYLE_PRESETS.success).toBeDefined();
        expect(STYLE_PRESETS.success.borderColor).toBe('#51cf66');
      });

      it('should have error preset', () => {
        expect(STYLE_PRESETS.error).toBeDefined();
        expect(STYLE_PRESETS.error.borderColor).toBe('#ff922b');
      });

      it('should have info preset', () => {
        expect(STYLE_PRESETS.info).toBeDefined();
        expect(STYLE_PRESETS.info.borderColor).toBe('#868e96');
      });
    });

    describe('DEFAULT_HIGHLIGHT_CONFIG', () => {
      it('should have correct defaults', () => {
        expect(DEFAULT_HIGHLIGHT_CONFIG.style).toBe('recording');
        expect(DEFAULT_HIGHLIGHT_CONFIG.borderWidth).toBe(3);
        expect(DEFAULT_HIGHLIGHT_CONFIG.duration).toBe(2000);
        expect(DEFAULT_HIGHLIGHT_CONFIG.zIndex).toBe(999999);
      });
    });
  });

  // ==========================================================================
  // HIGHLIGHT MANAGER
  // ==========================================================================

  describe('HighlightManager', () => {
    let manager: HighlightManager;

    beforeEach(() => {
      manager = new HighlightManager();
    });

    afterEach(() => {
      manager.destroy();
    });

    describe('highlight', () => {
      it('should create highlight overlay', () => {
        const element = document.getElementById('username')!;
        
        const id = manager.highlight(element);

        expect(id).toBeTruthy();
        expect(document.getElementById(id)).not.toBeNull();
      });

      it('should return unique IDs', () => {
        const element = document.getElementById('username')!;
        
        const id1 = manager.highlight(element);
        const id2 = manager.highlight(element);

        expect(id1).not.toBe(id2);
      });

      it('should apply style preset', () => {
        const element = document.getElementById('username')!;
        
        const id = manager.highlight(element, { style: 'success' });
        const overlay = document.getElementById(id)!;

        // JSDOM converts hex to rgb format
        expect(overlay.style.borderColor).toMatch(/#51cf66|rgb\(81, 207, 102\)/);
      });

      it('should create tooltip when configured', () => {
        const element = document.getElementById('username')!;
        
        const id = manager.highlight(element, {
          showTooltip: true,
          tooltipText: 'Test tooltip'
        });

        const tooltip = document.getElementById(`${id}-tooltip`);
        expect(tooltip).not.toBeNull();
        expect(tooltip?.textContent).toBe('Test tooltip');
      });

      it('should not create tooltip when text empty', () => {
        const element = document.getElementById('username')!;
        
        const id = manager.highlight(element, {
          showTooltip: true,
          tooltipText: ''
        });

        const tooltip = document.getElementById(`${id}-tooltip`);
        expect(tooltip).toBeNull();
      });

      it('should return empty string when paused', () => {
        const element = document.getElementById('username')!;
        manager.pause();
        
        const id = manager.highlight(element);

        expect(id).toBe('');
      });
    });

    describe('remove', () => {
      it('should remove highlight by ID', () => {
        const element = document.getElementById('username')!;
        const id = manager.highlight(element, { duration: 0 });

        const result = manager.remove(id);

        expect(result).toBe(true);
        // Note: Element may still exist briefly due to animation
      });

      it('should return false for non-existent ID', () => {
        const result = manager.remove('non-existent');
        expect(result).toBe(false);
      });

      it('should remove associated tooltip', () => {
        const element = document.getElementById('username')!;
        const id = manager.highlight(element, {
          duration: 0,
          showTooltip: true,
          tooltipText: 'Test'
        });

        manager.remove(id);

        // Tooltip should be scheduled for removal
        expect(manager.get(id)).toBeUndefined();
      });
    });

    describe('removeByElement', () => {
      it('should remove highlight by element', () => {
        const element = document.getElementById('username')!;
        manager.highlight(element, { duration: 0 });

        const result = manager.removeByElement(element);

        expect(result).toBe(true);
      });

      it('should return false for element without highlight', () => {
        const element = document.getElementById('username')!;
        const result = manager.removeByElement(element);
        expect(result).toBe(false);
      });
    });

    describe('clearAll', () => {
      it('should remove all highlights', () => {
        const el1 = document.getElementById('username')!;
        const el2 = document.getElementById('submit-btn')!;
        
        manager.highlight(el1, { duration: 0 });
        manager.highlight(el2, { duration: 0 });
        
        expect(manager.getCount()).toBe(2);

        manager.clearAll();

        expect(manager.getCount()).toBe(0);
      });
    });

    describe('update', () => {
      it('should update highlight config', () => {
        const element = document.getElementById('username')!;
        const id = manager.highlight(element, { 
          duration: 0,
          style: 'recording'
        });

        const result = manager.update(id, { style: 'success' });

        expect(result).toBe(true);
        const instance = manager.get(id);
        expect(instance?.config.style).toBe('success');
      });

      it('should return false for non-existent ID', () => {
        const result = manager.update('non-existent', {});
        expect(result).toBe(false);
      });

      it('should update tooltip text', () => {
        const element = document.getElementById('username')!;
        const id = manager.highlight(element, {
          duration: 0,
          showTooltip: true,
          tooltipText: 'Original'
        });

        manager.update(id, { tooltipText: 'Updated' });

        const tooltip = document.getElementById(`${id}-tooltip`);
        expect(tooltip?.textContent).toBe('Updated');
      });
    });

    describe('get', () => {
      it('should return highlight instance', () => {
        const element = document.getElementById('username')!;
        const id = manager.highlight(element, { duration: 0 });

        const instance = manager.get(id);

        expect(instance).toBeDefined();
        expect(instance?.element).toBe(element);
        expect(instance?.id).toBe(id);
      });

      it('should return undefined for non-existent ID', () => {
        expect(manager.get('non-existent')).toBeUndefined();
      });
    });

    describe('getActiveIds', () => {
      it('should return all active IDs', () => {
        const el1 = document.getElementById('username')!;
        const el2 = document.getElementById('submit-btn')!;
        
        const id1 = manager.highlight(el1, { duration: 0 });
        const id2 = manager.highlight(el2, { duration: 0 });

        const ids = manager.getActiveIds();

        expect(ids).toContain(id1);
        expect(ids).toContain(id2);
      });
    });

    describe('getCount', () => {
      it('should return count of active highlights', () => {
        const element = document.getElementById('username')!;
        
        expect(manager.getCount()).toBe(0);
        
        manager.highlight(element, { duration: 0 });
        expect(manager.getCount()).toBe(1);
        
        manager.highlight(element, { duration: 0 });
        expect(manager.getCount()).toBe(2);
      });
    });

    describe('pause/resume', () => {
      it('should pause and resume highlighting', () => {
        const element = document.getElementById('username')!;

        manager.pause();
        expect(manager.isActive()).toBe(false);
        
        const id = manager.highlight(element);
        expect(id).toBe('');

        manager.resume();
        expect(manager.isActive()).toBe(true);
        
        const id2 = manager.highlight(element);
        expect(id2).toBeTruthy();
      });
    });

    describe('destroy', () => {
      it('should clear all and deactivate', () => {
        const element = document.getElementById('username')!;
        manager.highlight(element, { duration: 0 });

        manager.destroy();

        expect(manager.getCount()).toBe(0);
        expect(manager.isActive()).toBe(false);
      });
    });
  });

  // ==========================================================================
  // STANDALONE FUNCTIONS
  // ==========================================================================

  describe('Standalone Functions', () => {
    describe('quickHighlight', () => {
      it('should highlight element briefly', () => {
        const element = document.getElementById('username')!;
        
        quickHighlight(element, 100);

        expect(getDefaultManager().getCount()).toBeGreaterThan(0);
      });
    });

    describe('highlightSuccess', () => {
      it('should highlight with success style', () => {
        const element = document.getElementById('username')!;
        
        highlightSuccess(element);

        const manager = getDefaultManager();
        const ids = manager.getActiveIds();
        expect(ids.length).toBeGreaterThan(0);
      });
    });

    describe('highlightError', () => {
      it('should highlight with error style and message', () => {
        const element = document.getElementById('username')!;
        
        highlightError(element, 'Error message');

        const manager = getDefaultManager();
        expect(manager.getCount()).toBeGreaterThan(0);
      });
    });

    describe('highlightRecording', () => {
      it('should highlight for recording (permanent)', () => {
        const element = document.getElementById('username')!;
        
        const id = highlightRecording(element, 'Recording...');

        expect(id).toBeTruthy();
        const instance = getDefaultManager().get(id);
        expect(instance?.config.duration).toBe(0);
      });
    });

    describe('highlightReplay', () => {
      it('should highlight for replay with step number', () => {
        const element = document.getElementById('username')!;
        
        const id = highlightReplay(element, 5);

        expect(id).toBeTruthy();
        const tooltip = document.getElementById(`${id}-tooltip`);
        expect(tooltip?.textContent).toBe('Step 5');
      });
    });

    describe('clearAllHighlights', () => {
      it('should clear all highlights', () => {
        const element = document.getElementById('username')!;
        highlightRecording(element);
        
        expect(getDefaultManager().getCount()).toBeGreaterThan(0);

        clearAllHighlights();

        expect(getDefaultManager().getCount()).toBe(0);
      });
    });

    describe('removeHighlight', () => {
      it('should remove specific highlight', () => {
        const element = document.getElementById('username')!;
        const id = highlightRecording(element);

        const result = removeHighlight(id);

        expect(result).toBe(true);
      });
    });
  });

  // ==========================================================================
  // BOUNDING BOX HIGHLIGHT
  // ==========================================================================

  describe('highlightBoundingBox', () => {
    it('should highlight bounding box area', () => {
      const box = { x: 100, y: 100, width: 200, height: 50 };

      const id = highlightBoundingBox(box);

      expect(id).toBeTruthy();
    });

    it('should use info style by default', () => {
      const box = { x: 100, y: 100, width: 200, height: 50 };

      const id = highlightBoundingBox(box);
      const instance = getDefaultManager().get(id);

      expect(instance?.config.style).toBe('info');
    });
  });

  // ==========================================================================
  // FLASH HIGHLIGHT
  // ==========================================================================

  describe('flashHighlight', () => {
    it('should flash element multiple times', async () => {
      const element = document.getElementById('username')!;

      await flashHighlight(element, 2, 50);

      // After flashing, no highlights should remain
      expect(getDefaultManager().getCount()).toBe(0);
    });
  });

  // ==========================================================================
  // DEFAULT MANAGER
  // ==========================================================================

  describe('Default Manager', () => {
    describe('getDefaultManager', () => {
      it('should return same instance', () => {
        const manager1 = getDefaultManager();
        const manager2 = getDefaultManager();

        expect(manager1).toBe(manager2);
      });
    });

    describe('resetDefaultManager', () => {
      it('should create new instance after reset', () => {
        const manager1 = getDefaultManager();
        const element = document.getElementById('username')!;
        manager1.highlight(element, { duration: 0 });

        resetDefaultManager();

        const manager2 = getDefaultManager();
        expect(manager2).not.toBe(manager1);
        expect(manager2.getCount()).toBe(0);
      });
    });
  });

  // ==========================================================================
  // SCROLL AND HIGHLIGHT
  // ==========================================================================

  describe('scrollAndHighlight', () => {
    it('should highlight element', async () => {
      const element = document.getElementById('username')!;

      const id = await scrollAndHighlight(element);

      expect(id).toBeTruthy();
    });
  });

  describe('ensureVisibleAndHighlight', () => {
    it('should highlight visible element', async () => {
      const element = document.getElementById('username')!;

      const id = await ensureVisibleAndHighlight(element);

      expect(id).toBeTruthy();
    });
  });
});
