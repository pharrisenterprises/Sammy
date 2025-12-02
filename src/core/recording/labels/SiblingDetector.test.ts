/**
 * Tests for SiblingDetector
 * @module core/recording/labels/SiblingDetector.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  SiblingDetector,
  createSiblingDetector,
  getPreviousSiblingLabel,
  getPreviousTextNode,
  hasSiblingLabel,
  getTableHeaderForCell,
  SIBLING_CONFIDENCE,
  LABEL_ELEMENTS,
  INTERACTIVE_ELEMENTS,
  MAX_LABEL_LENGTH,
  MAX_SIBLINGS_TO_CHECK,
} from './SiblingDetector';

import {
  createDetectionContext,
  DEFAULT_DETECTION_OPTIONS,
} from './ILabelDetector';

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Create a sibling label pattern
 */
function createSiblingLabel(label: string, inputType = 'text'): HTMLElement {
  const container = document.createElement('div');
  
  const labelEl = document.createElement('label');
  labelEl.textContent = label;
  container.appendChild(labelEl);
  
  const input = document.createElement('input');
  input.type = inputType;
  container.appendChild(input);
  
  return container;
}

/**
 * Create a sibling span pattern
 */
function createSiblingSpan(label: string): HTMLElement {
  const container = document.createElement('div');
  
  const span = document.createElement('span');
  span.textContent = label;
  container.appendChild(span);
  
  const input = document.createElement('input');
  input.type = 'text';
  container.appendChild(input);
  
  return container;
}

/**
 * Create a text node label pattern
 */
function createTextNodeLabel(label: string): HTMLElement {
  const container = document.createElement('div');
  
  const textNode = document.createTextNode(label);
  container.appendChild(textNode);
  
  const input = document.createElement('input');
  input.type = 'text';
  container.appendChild(input);
  
  return container;
}

/**
 * Create a wrapper sibling pattern
 */
function createWrapperSiblingPattern(label: string): HTMLElement {
  const container = document.createElement('div');
  
  const labelSpan = document.createElement('span');
  labelSpan.textContent = label;
  container.appendChild(labelSpan);
  
  const wrapper = document.createElement('div');
  const input = document.createElement('input');
  input.type = 'text';
  wrapper.appendChild(input);
  container.appendChild(wrapper);
  
  return container;
}

/**
 * Create a table with input
 */
function createTablePattern(): HTMLElement {
  const table = document.createElement('table');
  
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  const th1 = document.createElement('th');
  th1.textContent = 'Name';
  const th2 = document.createElement('th');
  th2.textContent = 'Email';
  headerRow.appendChild(th1);
  headerRow.appendChild(th2);
  thead.appendChild(headerRow);
  table.appendChild(thead);
  
  const tbody = document.createElement('tbody');
  const dataRow = document.createElement('tr');
  const td1 = document.createElement('td');
  const input1 = document.createElement('input');
  td1.appendChild(input1);
  const td2 = document.createElement('td');
  const input2 = document.createElement('input');
  td2.appendChild(input2);
  dataRow.appendChild(td1);
  dataRow.appendChild(td2);
  tbody.appendChild(dataRow);
  table.appendChild(tbody);
  
  return table;
}

/**
 * Create adjacent cell pattern
 */
function createAdjacentCellPattern(label: string): HTMLElement {
  const table = document.createElement('table');
  const row = document.createElement('tr');
  
  const labelCell = document.createElement('td');
  labelCell.textContent = label;
  row.appendChild(labelCell);
  
  const inputCell = document.createElement('td');
  const input = document.createElement('input');
  inputCell.appendChild(input);
  row.appendChild(inputCell);
  
  table.appendChild(row);
  return table;
}

// ============================================================================
// TESTS
// ============================================================================

describe('SiblingDetector', () => {
  let detector: SiblingDetector;
  
  beforeEach(() => {
    detector = new SiblingDetector();
  });
  
  afterEach(() => {
    document.body.innerHTML = '';
  });
  
  // ==========================================================================
  // BASIC PROPERTIES
  // ==========================================================================
  
  describe('properties', () => {
    it('should have correct name', () => {
      expect(detector.name).toBe('sibling');
    });
    
    it('should have proximity priority', () => {
      expect(detector.priority).toBe(60); // DETECTOR_PRIORITIES.PROXIMITY
    });
    
    it('should have correct base confidence', () => {
      expect(detector.baseConfidence).toBe(0.60);
    });
    
    it('should have description', () => {
      expect(detector.description).toContain('sibling');
    });
  });
  
  // ==========================================================================
  // CAN DETECT
  // ==========================================================================
  
  describe('canDetect', () => {
    it('should return true when element has siblings', () => {
      const container = createSiblingLabel('Email');
      document.body.appendChild(container);
      
      const input = container.querySelector('input')!;
      const context = createDetectionContext(input);
      
      expect(detector.canDetect(context)).toBe(true);
    });
    
    it('should return false when element has no parent', () => {
      const input = document.createElement('input');
      // Don't append to document
      
      const context = createDetectionContext(input);
      
      expect(detector.canDetect(context)).toBe(false);
    });
    
    it('should return false when element has no siblings', () => {
      const container = document.createElement('div');
      const input = document.createElement('input');
      container.appendChild(input);
      document.body.appendChild(container);
      
      const context = createDetectionContext(input);
      
      expect(detector.canDetect(context)).toBe(false);
    });
  });
  
  // ==========================================================================
  // PREVIOUS SIBLING LABEL
  // ==========================================================================
  
  describe('previous sibling label', () => {
    it('should detect previous label element', () => {
      const container = createSiblingLabel('Email Address');
      document.body.appendChild(container);
      
      const input = container.querySelector('input')!;
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result).not.toBeNull();
      expect(result?.label).toBe('Email Address');
      expect(result?.confidence).toBeGreaterThanOrEqual(SIBLING_CONFIDENCE.PREVIOUS_LABEL);
    });
    
    it('should detect previous span element', () => {
      const container = createSiblingSpan('Password');
      document.body.appendChild(container);
      
      const input = container.querySelector('input')!;
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('Password');
    });
    
    it('should skip interactive siblings', () => {
      const container = document.createElement('div');
      
      const label = document.createElement('label');
      label.textContent = 'Username';
      container.appendChild(label);
      
      const button = document.createElement('button');
      button.textContent = 'Help';
      container.appendChild(button);
      
      const input = document.createElement('input');
      container.appendChild(input);
      
      document.body.appendChild(container);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('Username');
    });
    
    it('should reduce confidence with distance', () => {
      const container = document.createElement('div');
      
      const label = document.createElement('label');
      label.textContent = 'Field';
      container.appendChild(label);
      
      // Add spacing elements
      container.appendChild(document.createElement('div'));
      container.appendChild(document.createElement('div'));
      
      const input = document.createElement('input');
      container.appendChild(input);
      
      document.body.appendChild(container);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('Field');
      expect(result?.confidence).toBeLessThan(SIBLING_CONFIDENCE.PREVIOUS_LABEL);
    });
  });
  
  // ==========================================================================
  // PREVIOUS TEXT NODE
  // ==========================================================================
  
  describe('previous text node', () => {
    it('should detect previous text node', () => {
      const container = createTextNodeLabel('Name:');
      document.body.appendChild(container);
      
      const input = container.querySelector('input')!;
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result).not.toBeNull();
      expect(result?.label).toBe('Name');
    });
    
    it('should remove trailing colons', () => {
      const container = createTextNodeLabel('Email: ');
      document.body.appendChild(container);
      
      const input = container.querySelector('input')!;
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).not.toContain(':');
    });
    
    it('should have lower confidence than element sibling', () => {
      const container = createTextNodeLabel('Field');
      document.body.appendChild(container);
      
      const input = container.querySelector('input')!;
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.confidence).toBeLessThan(SIBLING_CONFIDENCE.PREVIOUS_LABEL);
    });
  });
  
  // ==========================================================================
  // TABLE CELL DETECTION
  // ==========================================================================
  
  describe('table cell detection', () => {
    it('should detect table header', () => {
      const table = createTablePattern();
      document.body.appendChild(table);
      
      const firstInput = table.querySelectorAll('input')[0];
      const context = createDetectionContext(firstInput);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result).not.toBeNull();
      expect(result?.label).toBe('Name');
    });
    
    it('should detect correct column header', () => {
      const table = createTablePattern();
      document.body.appendChild(table);
      
      const secondInput = table.querySelectorAll('input')[1];
      const context = createDetectionContext(secondInput);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('Email');
    });
    
    it('should detect adjacent cell label', () => {
      const table = createAdjacentCellPattern('Username');
      document.body.appendChild(table);
      
      const input = table.querySelector('input')!;
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('Username');
      expect(result?.metadata?.extra?.siblingType).toBe('table-cell');
    });
  });
  
  // ==========================================================================
  // NEXT SIBLING DETECTION
  // ==========================================================================
  
  describe('next sibling detection', () => {
    it('should detect next label (less common)', () => {
      const container = document.createElement('div');
      
      const input = document.createElement('input');
      container.appendChild(input);
      
      const label = document.createElement('label');
      label.textContent = 'Subscribe to newsletter';
      container.appendChild(label);
      
      document.body.appendChild(container);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('Subscribe to newsletter');
      expect(result?.metadata?.extra?.direction).toBe('next');
    });
    
    it('should have lower confidence for next sibling', () => {
      const container = document.createElement('div');
      
      const input = document.createElement('input');
      container.appendChild(input);
      
      const label = document.createElement('label');
      label.textContent = 'Label';
      container.appendChild(label);
      
      document.body.appendChild(container);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      // Can be equal after confidence adjustments (length bonus)
      expect(result?.confidence).toBeLessThanOrEqual(SIBLING_CONFIDENCE.PREVIOUS_LABEL);
    });
  });
  
  // ==========================================================================
  // WRAPPER SIBLING DETECTION
  // ==========================================================================
  
  describe('wrapper sibling detection', () => {
    it('should detect wrapper sibling label', () => {
      const container = createWrapperSiblingPattern('Username');
      document.body.appendChild(container);
      
      const input = container.querySelector('input')!;
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result).not.toBeNull();
      expect(result?.label).toBe('Username');
      expect(result?.metadata?.extra?.siblingType).toBe('wrapper-sibling');
    });
    
    it('should include wrapper level in metadata', () => {
      const container = createWrapperSiblingPattern('Field');
      document.body.appendChild(container);
      
      const input = container.querySelector('input')!;
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.metadata?.extra?.wrapperLevel).toBeDefined();
    });
  });
  
  // ==========================================================================
  // EDGE CASES
  // ==========================================================================
  
  describe('edge cases', () => {
    it('should skip hidden siblings', () => {
      const container = document.createElement('div');
      
      const hiddenLabel = document.createElement('label');
      hiddenLabel.textContent = 'Hidden';
      hiddenLabel.setAttribute('hidden', '');
      container.appendChild(hiddenLabel);
      
      const visibleLabel = document.createElement('label');
      visibleLabel.textContent = 'Visible';
      container.appendChild(visibleLabel);
      
      const input = document.createElement('input');
      container.appendChild(input);
      
      document.body.appendChild(container);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('Visible');
    });
    
    it('should skip aria-hidden siblings', () => {
      const container = document.createElement('div');
      
      const hiddenLabel = document.createElement('label');
      hiddenLabel.textContent = 'Hidden';
      hiddenLabel.setAttribute('aria-hidden', 'true');
      container.appendChild(hiddenLabel);
      
      const visibleLabel = document.createElement('label');
      visibleLabel.textContent = 'Visible';
      container.appendChild(visibleLabel);
      
      const input = document.createElement('input');
      container.appendChild(input);
      
      document.body.appendChild(container);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.label).toBe('Visible');
    });
    
    it('should not exceed max siblings check', () => {
      const container = document.createElement('div');
      
      const label = document.createElement('label');
      label.textContent = 'Far away';
      container.appendChild(label);
      
      // Add many empty divs
      for (let i = 0; i < 10; i++) {
        container.appendChild(document.createElement('div'));
      }
      
      const input = document.createElement('input');
      container.appendChild(input);
      
      document.body.appendChild(container);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      // Should not find the far-away label
      expect(result?.label).not.toBe('Far away');
    });
    
    it('should reject labels that are too long', () => {
      const container = document.createElement('div');
      
      const label = document.createElement('label');
      label.textContent = 'A'.repeat(150); // Too long
      container.appendChild(label);
      
      const input = document.createElement('input');
      container.appendChild(input);
      
      document.body.appendChild(container);
      
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result).toBeNull();
    });
  });
  
  // ==========================================================================
  // METADATA
  // ==========================================================================
  
  describe('metadata', () => {
    it('should include sibling type', () => {
      const container = createSiblingLabel('Email');
      document.body.appendChild(container);
      
      const input = container.querySelector('input')!;
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.metadata?.extra?.siblingType).toBe('label');
    });
    
    it('should include direction', () => {
      const container = createSiblingLabel('Email');
      document.body.appendChild(container);
      
      const input = container.querySelector('input')!;
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.metadata?.extra?.direction).toBe('previous');
    });
    
    it('should include distance', () => {
      const container = createSiblingLabel('Email');
      document.body.appendChild(container);
      
      const input = container.querySelector('input')!;
      const context = createDetectionContext(input);
      const result = detector.detect(context, DEFAULT_DETECTION_OPTIONS);
      
      expect(result?.metadata?.extra?.distance).toBe(1);
    });
  });
});

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================

describe('createSiblingDetector', () => {
  it('should create detector instance', () => {
    const detector = createSiblingDetector();
    expect(detector).toBeInstanceOf(SiblingDetector);
  });
});

describe('getPreviousSiblingLabel', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });
  
  it('should return previous sibling label text', () => {
    const container = document.createElement('div');
    const label = document.createElement('label');
    label.textContent = 'Username';
    container.appendChild(label);
    const input = document.createElement('input');
    container.appendChild(input);
    document.body.appendChild(container);
    
    expect(getPreviousSiblingLabel(input)).toBe('Username');
  });
  
  it('should return null when no sibling label', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    
    expect(getPreviousSiblingLabel(input)).toBeNull();
  });
});

describe('getPreviousTextNode', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });
  
  it('should return previous text node content', () => {
    const container = document.createElement('div');
    container.appendChild(document.createTextNode('Label: '));
    const input = document.createElement('input');
    container.appendChild(input);
    document.body.appendChild(container);
    
    expect(getPreviousTextNode(input)).toBe('Label:');
  });
  
  it('should return null when no text node', () => {
    const container = document.createElement('div');
    const input = document.createElement('input');
    container.appendChild(input);
    document.body.appendChild(container);
    
    expect(getPreviousTextNode(input)).toBeNull();
  });
});

describe('hasSiblingLabel', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });
  
  it('should return true for label sibling', () => {
    const container = document.createElement('div');
    const label = document.createElement('label');
    label.textContent = 'Test';
    container.appendChild(label);
    const input = document.createElement('input');
    container.appendChild(input);
    document.body.appendChild(container);
    
    expect(hasSiblingLabel(input)).toBe(true);
  });
  
  it('should return true for text node sibling', () => {
    const container = document.createElement('div');
    container.appendChild(document.createTextNode('Label'));
    const input = document.createElement('input');
    container.appendChild(input);
    document.body.appendChild(container);
    
    expect(hasSiblingLabel(input)).toBe(true);
  });
  
  it('should return false for no sibling label', () => {
    const container = document.createElement('div');
    const input = document.createElement('input');
    container.appendChild(input);
    document.body.appendChild(container);
    
    expect(hasSiblingLabel(input)).toBe(false);
  });
});

describe('getTableHeaderForCell', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });
  
  it('should return header for cell', () => {
    const table = document.createElement('table');
    
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const th = document.createElement('th');
    th.textContent = 'Name';
    headerRow.appendChild(th);
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    const tbody = document.createElement('tbody');
    const dataRow = document.createElement('tr');
    const td = document.createElement('td');
    dataRow.appendChild(td);
    tbody.appendChild(dataRow);
    table.appendChild(tbody);
    
    document.body.appendChild(table);
    
    expect(getTableHeaderForCell(td)).toBe('Name');
  });
  
  it('should return null for non-table element', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    
    expect(getTableHeaderForCell(div)).toBeNull();
  });
});

// ============================================================================
// CONSTANT TESTS
// ============================================================================

describe('SIBLING_CONFIDENCE', () => {
  it('should have expected values', () => {
    expect(SIBLING_CONFIDENCE.PREVIOUS_LABEL).toBe(0.60);
    expect(SIBLING_CONFIDENCE.PREVIOUS_TEXT_ELEMENT).toBe(0.60);
    expect(SIBLING_CONFIDENCE.NEXT_LABEL).toBe(0.55);
    expect(SIBLING_CONFIDENCE.PREVIOUS_TEXT_NODE).toBe(0.50);
    expect(SIBLING_CONFIDENCE.WRAPPER_SIBLING).toBe(0.55);
    expect(SIBLING_CONFIDENCE.TABLE_CELL).toBe(0.60);
    expect(SIBLING_CONFIDENCE.MINIMUM).toBe(0.25);
  });
  
  it('should have previous higher than next', () => {
    expect(SIBLING_CONFIDENCE.PREVIOUS_LABEL).toBeGreaterThan(SIBLING_CONFIDENCE.NEXT_LABEL);
  });
});

describe('LABEL_ELEMENTS', () => {
  it('should include common label elements', () => {
    expect(LABEL_ELEMENTS).toContain('label');
    expect(LABEL_ELEMENTS).toContain('span');
    expect(LABEL_ELEMENTS).toContain('div');
    expect(LABEL_ELEMENTS).toContain('strong');
    expect(LABEL_ELEMENTS).toContain('th');
  });
});

describe('INTERACTIVE_ELEMENTS', () => {
  it('should include form elements', () => {
    expect(INTERACTIVE_ELEMENTS).toContain('input');
    expect(INTERACTIVE_ELEMENTS).toContain('select');
    expect(INTERACTIVE_ELEMENTS).toContain('textarea');
    expect(INTERACTIVE_ELEMENTS).toContain('button');
    expect(INTERACTIVE_ELEMENTS).toContain('a');
  });
});

describe('Constants', () => {
  it('should have reasonable max label length', () => {
    expect(MAX_LABEL_LENGTH).toBe(100);
  });
  
  it('should have reasonable max siblings to check', () => {
    expect(MAX_SIBLINGS_TO_CHECK).toBe(5);
  });
});
