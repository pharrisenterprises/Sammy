# Label Detection System
**Project:** Chrome Extension Test Recorder  
**Document Version:** 1.0  
**Last Updated:** November 22, 2025  
**Status:** Complete Specification

## Table of Contents
1. Overview
2. Label Detection Priority
3. The 12 Heuristics
4. Heuristic Implementation
5. Label Sanitization
6. Element-Specific Strategies
7. Fallback Strategies
8. Configuration Options
9. Testing and Validation
10. Performance Optimization

---

## 1. Overview

### 1.1 Purpose

The **Label Detection System** identifies human-readable labels for UI elements during recording. These labels:

- Provide **readable step descriptions** (e.g., "Click Submit Button" instead of "Click button#btn-123")
- Enable **semantic element identification** during replay
- Improve **test maintainability** by using meaningful names
- Support **variable naming** for parameterized tests

### 1.2 Design Goals

- ✅ **Accuracy** - Find the most relevant label for each element
- ✅ **Priority-based** - Use best available source
- ✅ **Comprehensive** - Handle all common UI patterns
- ✅ **Performance** - Fast detection with minimal DOM traversal
- ✅ **Sanitization** - Clean and normalize output

### 1.3 Label Sources

Labels can come from many sources:
1. Accessibility attributes (ARIA)
2. Form associations (`<label>` elements)
3. Element content (text, placeholder)
4. Semantic HTML (alt, title)
5. Custom data attributes

---

## 2. Label Detection Priority

### 2.1 Priority Order

Labels are detected in a specific priority order, with higher priority sources preferred:

| Priority | Heuristic | Source | Example |
|----------|-----------|--------|---------|
| 1 | `aria-label` | Accessibility attribute | `<button aria-label="Submit Form">` |
| 2 | `aria-labelledby` | Referenced element | `<span id="lbl">Submit</span><button aria-labelledby="lbl">` |
| 3 | `<label>` association | Form label element | `<label for="email">Email</label><input id="email">` |
| 4 | `placeholder` | Input placeholder | `<input placeholder="Enter email">` |
| 5 | `title` | Title attribute | `<button title="Submit the form">` |
| 6 | `alt` | Image alt text | `<img alt="Submit icon">` |
| 7 | `name` | Name attribute | `<input name="email_address">` |
| 8 | Visible text | Element text content | `<button>Submit</button>` |
| 9 | `value` | Button/input value | `<input type="submit" value="Send">` |
| 10 | Child image alt | Nested image alt | `<button><img alt="Send"></button>` |
| 11 | Nearby text | Adjacent text nodes | `Email: <input>` |
| 12 | Data attributes | data-label, data-name | `<button data-label="submit-btn">` |

### 2.2 Priority Rationale

**Why this order?**

1. **ARIA attributes** (1-2): Explicitly define accessible names, highest intent
2. **Form labels** (3): Designed specifically for labeling inputs
3. **Placeholder/title** (4-5): Common UI labeling patterns
4. **Alt text** (6): Semantic HTML for images
5. **Name attribute** (7): Often reflects field purpose
6. **Visible text** (8): What users see
7. **Value** (9): Submit button values
8. **Child content** (10): Nested semantic elements
9. **Nearby text** (11): Last resort positional
10. **Data attributes** (12): Custom developer labels

---

## 3. The 12 Heuristics

### 3.1 Heuristic Interface

```typescript
interface LabelHeuristic {
  name: string;
  priority: number;
  detect: (element: HTMLElement) => string | null;
}

interface LabelDetectorConfig {
  maxLabelLength: number;
  enabledHeuristics: string[];
  sanitizeOutput: boolean;
  fallbackToTagName: boolean;
}

const DEFAULT_CONFIG: LabelDetectorConfig = {
  maxLabelLength: 50,
  enabledHeuristics: [
    'aria-label',
    'aria-labelledby',
    'label-for',
    'placeholder',
    'title',
    'alt',
    'name',
    'visible-text',
    'value',
    'child-alt',
    'nearby-text',
    'data-attrs'
  ],
  sanitizeOutput: true,
  fallbackToTagName: true
};
```

### 3.2 Heuristic Definitions

```typescript
const HEURISTICS: LabelHeuristic[] = [
  {
    name: 'aria-label',
    priority: 1,
    detect: (el) => el.getAttribute('aria-label')
  },
  {
    name: 'aria-labelledby',
    priority: 2,
    detect: (el) => {
      const labelledBy = el.getAttribute('aria-labelledby');
      if (!labelledBy) return null;
      
      const ids = labelledBy.split(/\s+/);
      const labels = ids
        .map(id => document.getElementById(id)?.textContent?.trim())
        .filter(Boolean);
      
      return labels.length > 0 ? labels.join(' ') : null;
    }
  },
  {
    name: 'label-for',
    priority: 3,
    detect: (el) => {
      // Check if element has associated label
      if (el.id) {
        const label = document.querySelector(`label[for="${el.id}"]`);
        if (label) return label.textContent?.trim() || null;
      }
      
      // Check if element is inside a label
      const parentLabel = el.closest('label');
      if (parentLabel) {
        // Get label text excluding the input element
        const clone = parentLabel.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('input, select, textarea').forEach(el => el.remove());
        return clone.textContent?.trim() || null;
      }
      
      return null;
    }
  },
  {
    name: 'placeholder',
    priority: 4,
    detect: (el) => (el as HTMLInputElement).placeholder || null
  },
  {
    name: 'title',
    priority: 5,
    detect: (el) => el.getAttribute('title')
  },
  {
    name: 'alt',
    priority: 6,
    detect: (el) => (el as HTMLImageElement).alt || null
  },
  {
    name: 'name',
    priority: 7,
    detect: (el) => {
      const name = (el as HTMLInputElement).name;
      if (!name) return null;
      
      // Convert name to readable format
      return formatAttributeName(name);
    }
  },
  {
    name: 'visible-text',
    priority: 8,
    detect: (el) => {
      // Get direct text content (excluding hidden children)
      const text = getVisibleTextContent(el);
      return text || null;
    }
  },
  {
    name: 'value',
    priority: 9,
    detect: (el) => {
      const input = el as HTMLInputElement;
      
      // Only for submit buttons
      if (input.type === 'submit' || input.type === 'button') {
        return input.value || null;
      }
      
      return null;
    }
  },
  {
    name: 'child-alt',
    priority: 10,
    detect: (el) => {
      // Check for img child with alt
      const img = el.querySelector('img[alt]');
      if (img) return (img as HTMLImageElement).alt;
      
      // Check for svg with title
      const svg = el.querySelector('svg title');
      if (svg) return svg.textContent?.trim() || null;
      
      return null;
    }
  },
  {
    name: 'nearby-text',
    priority: 11,
    detect: (el) => {
      return findNearbyLabel(el);
    }
  },
  {
    name: 'data-attrs',
    priority: 12,
    detect: (el) => {
      // Common data attribute patterns
      const dataAttrs = [
        'data-label',
        'data-name',
        'data-title',
        'data-testid',
        'data-test',
        'data-cy'
      ];
      
      for (const attr of dataAttrs) {
        const value = el.getAttribute(attr);
        if (value) return formatAttributeName(value);
      }
      
      return null;
    }
  }
];
```

---

## 4. Heuristic Implementation

### 4.1 LabelDetector Class

```typescript
class LabelDetector {
  private config: LabelDetectorConfig;
  private heuristics: LabelHeuristic[];
  
  constructor(config: Partial<LabelDetectorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.heuristics = this.filterHeuristics();
  }
  
  private filterHeuristics(): LabelHeuristic[] {
    return HEURISTICS
      .filter(h => this.config.enabledHeuristics.includes(h.name))
      .sort((a, b) => a.priority - b.priority);
  }
  
  detect(element: HTMLElement): string {
    // Try each heuristic in priority order
    for (const heuristic of this.heuristics) {
      try {
        const label = heuristic.detect(element);
        
        if (label && label.trim().length > 0) {
          console.log(`[LabelDetector] Found label via ${heuristic.name}:`, label);
          
          // Sanitize and return
          return this.sanitize(label);
        }
      } catch (error) {
        console.warn(`[LabelDetector] Heuristic ${heuristic.name} failed:`, error);
      }
    }
    
    // Fallback to tag name
    if (this.config.fallbackToTagName) {
      return this.generateFallbackLabel(element);
    }
    
    return 'Unknown Element';
  }
  
  private sanitize(label: string): string {
    if (!this.config.sanitizeOutput) {
      return label;
    }
    
    let sanitized = label;
    
    // Trim whitespace
    sanitized = sanitized.trim();
    
    // Collapse multiple whitespace
    sanitized = sanitized.replace(/\s+/g, ' ');
    
    // Remove special characters
    sanitized = sanitized.replace(/[^\w\s\-_.]/g, '');
    
    // Truncate to max length
    if (sanitized.length > this.config.maxLabelLength) {
      sanitized = sanitized.substring(0, this.config.maxLabelLength - 3) + '...';
    }
    
    // Title case
    sanitized = this.toTitleCase(sanitized);
    
    return sanitized;
  }
  
  private toTitleCase(str: string): string {
    return str.replace(/\w\S*/g, (txt) => {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
  }
  
  private generateFallbackLabel(element: HTMLElement): string {
    const tagName = element.tagName.toLowerCase();
    const type = (element as HTMLInputElement).type;
    
    // Generate descriptive fallback
    if (tagName === 'input') {
      return type ? `${this.toTitleCase(type)} Input` : 'Text Input';
    }
    
    if (tagName === 'button') {
      return 'Button';
    }
    
    if (tagName === 'a') {
      return 'Link';
    }
    
    if (tagName === 'select') {
      return 'Dropdown';
    }
    
    if (tagName === 'textarea') {
      return 'Text Area';
    }
    
    return this.toTitleCase(tagName);
  }
}
```

### 4.2 Helper Functions

```typescript
/**
 * Get visible text content, excluding hidden elements
 */
function getVisibleTextContent(element: HTMLElement): string | null {
  // Clone element to avoid modifying original
  const clone = element.cloneNode(true) as HTMLElement;
  
  // Remove hidden elements
  clone.querySelectorAll('[hidden], [style*="display: none"], [style*="visibility: hidden"]')
    .forEach(el => el.remove());
  
  // Remove script and style elements
  clone.querySelectorAll('script, style').forEach(el => el.remove());
  
  // Get text content
  const text = clone.textContent?.trim();
  
  // Return null if empty or too long (probably not a label)
  if (!text || text.length > 200) {
    return null;
  }
  
  return text;
}

/**
 * Format attribute name to readable label
 * e.g., "email_address" -> "Email Address"
 * e.g., "btnSubmit" -> "Btn Submit"
 */
function formatAttributeName(name: string): string {
  return name
    // Split camelCase
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    // Replace separators with space
    .replace(/[-_]/g, ' ')
    // Remove common prefixes/suffixes
    .replace(/^(btn|input|txt|lbl|chk|rad|sel)/i, '')
    // Trim
    .trim();
}

/**
 * Find nearby text that might be a label
 */
function findNearbyLabel(element: HTMLElement): string | null {
  // Check previous sibling text
  const prevSibling = element.previousSibling;
  if (prevSibling && prevSibling.nodeType === Node.TEXT_NODE) {
    const text = prevSibling.textContent?.trim();
    if (text && text.length > 0 && text.length < 50) {
      // Remove trailing colon
      return text.replace(/:$/, '').trim();
    }
  }
  
  // Check previous element sibling
  const prevElement = element.previousElementSibling;
  if (prevElement) {
    const text = prevElement.textContent?.trim();
    if (text && text.length > 0 && text.length < 50) {
      return text.replace(/:$/, '').trim();
    }
  }
  
  // Check parent's previous sibling
  const parent = element.parentElement;
  if (parent) {
    const parentPrev = parent.previousElementSibling;
    if (parentPrev) {
      const text = parentPrev.textContent?.trim();
      if (text && text.length > 0 && text.length < 50) {
        return text.replace(/:$/, '').trim();
      }
    }
  }
  
  // Check for table cell header
  const td = element.closest('td');
  if (td) {
    const row = td.parentElement as HTMLTableRowElement;
    const cellIndex = Array.from(row.cells).indexOf(td as HTMLTableCellElement);
    
    // Find corresponding header
    const table = td.closest('table');
    const thead = table?.querySelector('thead');
    if (thead) {
      const headerRow = thead.querySelector('tr');
      const th = headerRow?.cells[cellIndex];
      if (th) {
        return th.textContent?.trim() || null;
      }
    }
  }
  
  return null;
}
```

---

## 5. Label Sanitization

### 5.1 Sanitization Rules

```typescript
class LabelSanitizer {
  private maxLength: number;
  
  constructor(maxLength: number = 50) {
    this.maxLength = maxLength;
  }
  
  sanitize(label: string): string {
    let result = label;
    
    // 1. Trim whitespace
    result = result.trim();
    
    // 2. Collapse multiple whitespace
    result = result.replace(/\s+/g, ' ');
    
    // 3. Remove newlines and tabs
    result = result.replace(/[\n\r\t]/g, ' ');
    
    // 4. Remove zero-width characters
    result = result.replace(/[\u200B-\u200D\uFEFF]/g, '');
    
    // 5. Remove HTML entities (already decoded, but catch any)
    result = result.replace(/&[a-z]+;/gi, '');
    
    // 6. Remove emoji (optional, can make labels cleaner)
    result = this.removeEmoji(result);
    
    // 7. Remove leading/trailing punctuation
    result = result.replace(/^[^\w]+|[^\w]+$/g, '');
    
    // 8. Truncate
    if (result.length > this.maxLength) {
      result = result.substring(0, this.maxLength - 3) + '...';
    }
    
    return result;
  }
  
  private removeEmoji(str: string): string {
    // Remove common emoji ranges
    return str.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
  }
}
```

### 5.2 Special Cases

```typescript
class LabelSanitizer {
  // ... previous code
  
  handleSpecialCases(label: string, element: HTMLElement): string {
    // Password fields
    if ((element as HTMLInputElement).type === 'password') {
      return 'Password';
    }
    
    // File inputs
    if ((element as HTMLInputElement).type === 'file') {
      return label || 'Choose File';
    }
    
    // Icon-only buttons
    if (this.isIconOnlyElement(element)) {
      // Try to get icon meaning from class
      const iconLabel = this.getIconLabel(element);
      if (iconLabel) return iconLabel;
    }
    
    // Numbers/dates might not be good labels
    if (/^\d+$/.test(label)) {
      return this.generateContextualLabel(element);
    }
    
    return label;
  }
  
  private isIconOnlyElement(element: HTMLElement): boolean {
    // Check for common icon patterns
    const hasIconClass = element.className.match(/icon|fa-|material-icons|feather/i);
    const hasNoText = !getVisibleTextContent(element);
    const hasSvg = element.querySelector('svg') !== null;
    
    return !!(hasIconClass || (hasNoText && hasSvg));
  }
  
  private getIconLabel(element: HTMLElement): string | null {
    // Check for icon class patterns
    const className = element.className;
    
    // Font Awesome pattern: fa-{name}
    const faMatch = className.match(/fa-([a-z-]+)/i);
    if (faMatch) {
      return formatAttributeName(faMatch[1]);
    }
    
    // Material Icons pattern: material-icons with text content
    if (className.includes('material-icons')) {
      const iconName = element.textContent?.trim();
      if (iconName) return formatAttributeName(iconName);
    }
    
    // Check aria-label on icon element
    const svg = element.querySelector('svg');
    if (svg) {
      const ariaLabel = svg.getAttribute('aria-label');
      if (ariaLabel) return ariaLabel;
    }
    
    return null;
  }
  
  private generateContextualLabel(element: HTMLElement): string {
    // Use element context for better label
    const parent = element.parentElement;
    
    if (parent) {
      const parentLabel = parent.getAttribute('aria-label') ||
                         parent.getAttribute('title');
      if (parentLabel) return parentLabel;
    }
    
    return this.generateFallbackLabel(element);
  }
}
```

---

## 6. Element-Specific Strategies

### 6.1 Input Elements

```typescript
class InputLabelDetector {
  detect(input: HTMLInputElement): string {
    const type = input.type?.toLowerCase() || 'text';
    
    switch (type) {
      case 'text':
      case 'email':
      case 'tel':
      case 'url':
      case 'search':
      case 'number':
        return this.detectTextInput(input);
      
      case 'password':
        return 'Password';
      
      case 'checkbox':
        return this.detectCheckbox(input);
      
      case 'radio':
        return this.detectRadio(input);
      
      case 'file':
        return this.detectFileInput(input);
      
      case 'submit':
      case 'button':
        return this.detectButtonInput(input);
      
      case 'hidden':
        return input.name ? formatAttributeName(input.name) : 'Hidden Input';
      
      default:
        return this.detectTextInput(input);
    }
  }
  
  private detectTextInput(input: HTMLInputElement): string {
    // Priority: label > placeholder > name > type
    
    // Check associated label
    if (input.id) {
      const label = document.querySelector(`label[for="${input.id}"]`);
      if (label?.textContent) {
        return label.textContent.trim();
      }
    }
    
    // Check parent label
    const parentLabel = input.closest('label');
    if (parentLabel) {
      const clone = parentLabel.cloneNode(true) as HTMLElement;
      clone.querySelector('input')?.remove();
      const text = clone.textContent?.trim();
      if (text) return text;
    }
    
    // Check placeholder
    if (input.placeholder) {
      return input.placeholder;
    }
    
    // Check name attribute
    if (input.name) {
      return formatAttributeName(input.name);
    }
    
    // Check aria-label
    const ariaLabel = input.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;
    
    // Fallback to type
    return `${input.type.charAt(0).toUpperCase() + input.type.slice(1)} Input`;
  }
  
  private detectCheckbox(input: HTMLInputElement): string {
    // Check associated label
    const label = this.getAssociatedLabel(input);
    if (label) return label;
    
    // Check adjacent text
    const next = input.nextSibling;
    if (next && next.nodeType === Node.TEXT_NODE) {
      const text = next.textContent?.trim();
      if (text) return text;
    }
    
    // Check name
    if (input.name) {
      return formatAttributeName(input.name);
    }
    
    return 'Checkbox';
  }
  
  private detectRadio(input: HTMLInputElement): string {
    // Get label for this specific radio
    const label = this.getAssociatedLabel(input);
    if (label) return label;
    
    // Check value (often descriptive for radios)
    if (input.value && input.value !== 'on') {
      return formatAttributeName(input.value);
    }
    
    // Check name for radio group name
    if (input.name) {
      return formatAttributeName(input.name);
    }
    
    return 'Radio Option';
  }
  
  private detectFileInput(input: HTMLInputElement): string {
    // Check label
    const label = this.getAssociatedLabel(input);
    if (label) return label;
    
    // Check accept attribute for context
    const accept = input.accept;
    if (accept) {
      if (accept.includes('image')) return 'Choose Image';
      if (accept.includes('pdf')) return 'Choose PDF';
      if (accept.includes('video')) return 'Choose Video';
    }
    
    return 'Choose File';
  }
  
  private detectButtonInput(input: HTMLInputElement): string {
    // Value is the displayed text
    if (input.value) {
      return input.value;
    }
    
    // Check name
    if (input.name) {
      return formatAttributeName(input.name);
    }
    
    return input.type === 'submit' ? 'Submit' : 'Button';
  }
  
  private getAssociatedLabel(input: HTMLInputElement): string | null {
    // Via for attribute
    if (input.id) {
      const label = document.querySelector(`label[for="${input.id}"]`);
      if (label?.textContent) {
        return label.textContent.trim();
      }
    }
    
    // Via wrapping label
    const parentLabel = input.closest('label');
    if (parentLabel) {
      const clone = parentLabel.cloneNode(true) as HTMLElement;
      clone.querySelector('input')?.remove();
      const text = clone.textContent?.trim();
      if (text) return text;
    }
    
    return null;
  }
}
```

### 6.2 Button Elements

```typescript
class ButtonLabelDetector {
  detect(button: HTMLButtonElement): string {
    // Check aria-label
    const ariaLabel = button.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;
    
    // Check visible text
    const text = getVisibleTextContent(button);
    if (text) return text;
    
    // Check value (for input type="button")
    if (button.value) return button.value;
    
    // Check nested img alt
    const img = button.querySelector('img');
    if (img?.alt) return img.alt;
    
    // Check nested svg title
    const svgTitle = button.querySelector('svg title');
    if (svgTitle?.textContent) return svgTitle.textContent.trim();
    
    // Check icon class
    const iconLabel = this.detectIconLabel(button);
    if (iconLabel) return iconLabel;
    
    // Check title attribute
    if (button.title) return button.title;
    
    // Fallback based on type
    const type = button.type || 'button';
    if (type === 'submit') return 'Submit';
    if (type === 'reset') return 'Reset';
    
    return 'Button';
  }
  
  private detectIconLabel(button: HTMLElement): string | null {
    const className = button.className;
    
    // Common icon button patterns
    const patterns = [
      { regex: /close|dismiss|cancel/i, label: 'Close' },
      { regex: /search/i, label: 'Search' },
      { regex: /menu|hamburger/i, label: 'Menu' },
      { regex: /add|plus|create/i, label: 'Add' },
      { regex: /edit|pencil/i, label: 'Edit' },
      { regex: /delete|trash|remove/i, label: 'Delete' },
      { regex: /save|floppy/i, label: 'Save' },
      { regex: /settings|cog|gear/i, label: 'Settings' },
      { regex: /user|profile|account/i, label: 'Profile' },
      { regex: /cart|basket/i, label: 'Cart' },
      { regex: /heart|favorite|like/i, label: 'Favorite' },
      { regex: /share/i, label: 'Share' },
      { regex: /download/i, label: 'Download' },
      { regex: /upload/i, label: 'Upload' },
      { regex: /refresh|reload/i, label: 'Refresh' },
      { regex: /expand|chevron-down/i, label: 'Expand' },
      { regex: /collapse|chevron-up/i, label: 'Collapse' },
      { regex: /next|arrow-right/i, label: 'Next' },
      { regex: /prev|back|arrow-left/i, label: 'Previous' },
      { regex: /play/i, label: 'Play' },
      { regex: /pause/i, label: 'Pause' },
      { regex: /stop/i, label: 'Stop' }
    ];
    
    for (const pattern of patterns) {
      if (pattern.regex.test(className)) {
        return pattern.label;
      }
    }
    
    return null;
  }
}
```

### 6.3 Link Elements

```typescript
class LinkLabelDetector {
  detect(link: HTMLAnchorElement): string {
    // Check aria-label
    const ariaLabel = link.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;
    
    // Check visible text
    const text = getVisibleTextContent(link);
    if (text) return text;
    
    // Check nested img alt
    const img = link.querySelector('img');
    if (img?.alt) return img.alt;
    
    // Check title
    if (link.title) return link.title;
    
    // Use href as last resort (clean it up)
    if (link.href) {
      return this.labelFromHref(link.href);
    }
    
    return 'Link';
  }
  
  private labelFromHref(href: string): string {
    try {
      const url = new URL(href);
      
      // Use pathname
      const path = url.pathname;
      
      // Get last segment
      const segments = path.split('/').filter(Boolean);
      const lastSegment = segments[segments.length - 1];
      
      if (lastSegment) {
        // Remove file extension
        const name = lastSegment.replace(/\.[^.]+$/, '');
        return formatAttributeName(name);
      }
      
      // Use hostname
      return url.hostname;
      
    } catch {
      return 'Link';
    }
  }
}
```

### 6.4 Select Elements

```typescript
class SelectLabelDetector {
  detect(select: HTMLSelectElement): string {
    // Check associated label
    if (select.id) {
      const label = document.querySelector(`label[for="${select.id}"]`);
      if (label?.textContent) {
        return label.textContent.trim();
      }
    }
    
    // Check aria-label
    const ariaLabel = select.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;
    
    // Check name attribute
    if (select.name) {
      return formatAttributeName(select.name);
    }
    
    // Use first option as hint (if it's a placeholder)
    const firstOption = select.options[0];
    if (firstOption && firstOption.value === '') {
      return firstOption.textContent?.trim() || 'Select';
    }
    
    return 'Dropdown';
  }
}
```

---

## 7. Fallback Strategies

### 7.1 Context-Based Fallback

```typescript
class FallbackLabelGenerator {
  generate(element: HTMLElement): string {
    // Try parent context
    const parentLabel = this.getParentContext(element);
    if (parentLabel) return parentLabel;
    
    // Try sibling context
    const siblingLabel = this.getSiblingContext(element);
    if (siblingLabel) return siblingLabel;
    
    // Try form context
    const formLabel = this.getFormContext(element);
    if (formLabel) return formLabel;
    
    // Generate from tag and type
    return this.generateFromElement(element);
  }
  
  private getParentContext(element: HTMLElement): string | null {
    let parent = element.parentElement;
    let depth = 0;
    const maxDepth = 3;
    
    while (parent && depth < maxDepth) {
      // Check parent aria-label
      const ariaLabel = parent.getAttribute('aria-label');
      if (ariaLabel) return ariaLabel;
      
      // Check parent heading
      const heading = parent.querySelector('h1, h2, h3, h4, h5, h6');
      if (heading && heading !== element) {
        return heading.textContent?.trim() || null;
      }
      
      // Check fieldset legend
      if (parent.tagName === 'FIELDSET') {
        const legend = parent.querySelector('legend');
        if (legend) return legend.textContent?.trim() || null;
      }
      
      parent = parent.parentElement;
      depth++;
    }
    
    return null;
  }
  
  private getSiblingContext(element: HTMLElement): string | null {
    // Check preceding heading
    let sibling = element.previousElementSibling;
    
    while (sibling) {
      if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(sibling.tagName)) {
        return sibling.textContent?.trim() || null;
      }
      
      // Stop if we hit another interactive element
      if (sibling.matches('input, button, select, textarea, a')) {
        break;
      }
      
      sibling = sibling.previousElementSibling;
    }
    
    return null;
  }
  
  private getFormContext(element: HTMLElement): string | null {
    const form = element.closest('form');
    if (!form) return null;
    
    // Check form aria-label
    const ariaLabel = form.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;
    
    // Check form name
    if (form.name) {
      return formatAttributeName(form.name) + ' Form';
    }
    
    // Check form id
    if (form.id) {
      return formatAttributeName(form.id) + ' Form';
    }
    
    return null;
  }
  
  private generateFromElement(element: HTMLElement): string {
    const tagName = element.tagName.toLowerCase();
    const type = (element as HTMLInputElement).type;
    const role = element.getAttribute('role');
    
    // Use role if available
    if (role) {
      return formatAttributeName(role);
    }
    
    // Element-specific labels
    const tagLabels: Record<string, string> = {
      'button': 'Button',
      'a': 'Link',
      'input': type ? `${type.charAt(0).toUpperCase() + type.slice(1)} Input` : 'Input',
      'select': 'Dropdown',
      'textarea': 'Text Area',
      'img': 'Image',
      'video': 'Video',
      'audio': 'Audio',
      'canvas': 'Canvas',
      'iframe': 'Frame'
    };
    
    return tagLabels[tagName] || tagName.charAt(0).toUpperCase() + tagName.slice(1);
  }
}
```

### 7.2 Machine-Generated Labels

```typescript
class AutoLabelGenerator {
  generate(element: HTMLElement, index: number): string {
    const tagName = element.tagName.toLowerCase();
    const type = (element as HTMLInputElement).type;
    
    // Generate unique label
    const base = this.getBaseName(element);
    const position = this.getPositionDescription(element);
    
    return `${base}${position ? ' ' + position : ''} ${index}`;
  }
  
  private getBaseName(element: HTMLElement): string {
    const tag = element.tagName.toLowerCase();
    const type = (element as HTMLInputElement).type?.toLowerCase();
    
    if (tag === 'input' && type) {
      return type.charAt(0).toUpperCase() + type.slice(1);
    }
    
    return tag.charAt(0).toUpperCase() + tag.slice(1);
  }
  
  private getPositionDescription(element: HTMLElement): string {
    const rect = element.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let horizontal = '';
    let vertical = '';
    
    // Horizontal position
    if (rect.left < viewportWidth / 3) {
      horizontal = 'Left';
    } else if (rect.right > (viewportWidth * 2) / 3) {
      horizontal = 'Right';
    } else {
      horizontal = 'Center';
    }
    
    // Vertical position
    if (rect.top < viewportHeight / 3) {
      vertical = 'Top';
    } else if (rect.bottom > (viewportHeight * 2) / 3) {
      vertical = 'Bottom';
    } else {
      vertical = 'Middle';
    }
    
    return `${vertical} ${horizontal}`;
  }
}
```

---

## 8. Configuration Options

### 8.1 Full Configuration

```typescript
interface LabelDetectorConfig {
  // Maximum label length
  maxLabelLength: number;
  
  // Enabled heuristics (in priority order)
  enabledHeuristics: string[];
  
  // Sanitization options
  sanitizeOutput: boolean;
  removeEmoji: boolean;
  titleCase: boolean;
  
  // Fallback options
  fallbackToTagName: boolean;
  usePositionInFallback: boolean;
  
  // Element-specific options
  maskPasswords: boolean;
  includeInputType: boolean;
  
  // Context search depth
  parentSearchDepth: number;
  siblingSearchRange: number;
}

const DEFAULT_CONFIG: LabelDetectorConfig = {
  maxLabelLength: 50,
  enabledHeuristics: [
    'aria-label',
    'aria-labelledby',
    'label-for',
    'placeholder',
    'title',
    'alt',
    'name',
    'visible-text',
    'value',
    'child-alt',
    'nearby-text',
    'data-attrs'
  ],
  sanitizeOutput: true,
  removeEmoji: true,
  titleCase: true,
  fallbackToTagName: true,
  usePositionInFallback: false,
  maskPasswords: true,
  includeInputType: true,
  parentSearchDepth: 3,
  siblingSearchRange: 2
};
```

### 8.2 Runtime Configuration

```typescript
// Configure label detection at runtime
const labelDetector = new LabelDetector({
  maxLabelLength: 30,
  removeEmoji: false,
  enabledHeuristics: [
    'aria-label',
    'label-for',
    'placeholder',
    'visible-text'
  ]
});

// Use custom configuration for specific elements
const customConfig: Partial<LabelDetectorConfig> = {
  titleCase: false,
  includeInputType: false
};

const label = labelDetector.detect(element, customConfig);
```

---

## 9. Testing and Validation

### 9.1 Unit Tests

```typescript
describe('LabelDetector', () => {
  let detector: LabelDetector;
  
  beforeEach(() => {
    detector = new LabelDetector();
  });
  
  describe('aria-label heuristic', () => {
    it('should detect aria-label', () => {
      const button = document.createElement('button');
      button.setAttribute('aria-label', 'Submit Form');
      
      expect(detector.detect(button)).toBe('Submit Form');
    });
  });
  
  describe('label-for heuristic', () => {
    it('should detect associated label', () => {
      document.body.innerHTML = `
        <label for="email">Email Address</label>
        <input id="email" type="email">
      `;
      
      const input = document.getElementById('email') as HTMLInputElement;
      expect(detector.detect(input)).toBe('Email Address');
    });
    
    it('should detect wrapping label', () => {
      document.body.innerHTML = `
        <label>
          Email Address
          <input type="email">
        </label>
      `;
      
      const input = document.querySelector('input') as HTMLInputElement;
      expect(detector.detect(input)).toBe('Email Address');
    });
  });
  
  describe('placeholder heuristic', () => {
    it('should detect placeholder', () => {
      const input = document.createElement('input');
      input.placeholder = 'Enter your email';
      
      expect(detector.detect(input)).toBe('Enter Your Email');
    });
  });
  
  describe('visible-text heuristic', () => {
    it('should detect button text', () => {
      const button = document.createElement('button');
      button.textContent = 'Click Me';
      
      expect(detector.detect(button)).toBe('Click Me');
    });
    
    it('should exclude hidden text', () => {
      document.body.innerHTML = `
        <button>
          Visible
          <span style="display: none">Hidden</span>
        </button>
      `;
      
      const button = document.querySelector('button') as HTMLButtonElement;
      expect(detector.detect(button)).toBe('Visible');
    });
  });
  
  describe('sanitization', () => {
    it('should truncate long labels', () => {
      const button = document.createElement('button');
      button.textContent = 'This is a very long button label that should be truncated';
      
      const detector = new LabelDetector({ maxLabelLength: 20 });
      const label = detector.detect(button);
      
      expect(label.length).toBeLessThanOrEqual(20);
      expect(label).toContain('...');
    });
    
    it('should collapse whitespace', () => {
      const button = document.createElement('button');
      button.textContent = '  Multiple   Spaces  ';
      
      expect(detector.detect(button)).toBe('Multiple Spaces');
    });
  });
});
```

### 9.2 Integration Tests

```typescript
describe('LabelDetector Integration', () => {
  it('should detect labels in complex forms', () => {
    document.body.innerHTML = `
      <form aria-label="Registration Form">
        <fieldset>
          <legend>Personal Info</legend>
          
          <label for="name">Full Name</label>
          <input id="name" type="text">
          
          <label for="email">Email</label>
          <input id="email" type="email" placeholder="you@example.com">
        </fieldset>
        
        <button type="submit">Register</button>
      </form>
    `;
    
    const detector = new LabelDetector();
    
    const nameInput = document.getElementById('name') as HTMLInputElement;
    expect(detector.detect(nameInput)).toBe('Full Name');
    
    const emailInput = document.getElementById('email') as HTMLInputElement;
    expect(detector.detect(emailInput)).toBe('Email');
    
    const submitButton = document.querySelector('button') as HTMLButtonElement;
    expect(detector.detect(submitButton)).toBe('Register');
  });
  
  it('should handle shadow DOM', () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <button aria-label="Shadow Button">Click</button>
    `;
    document.body.appendChild(host);
    
    const detector = new LabelDetector();
    const button = shadow.querySelector('button') as HTMLButtonElement;
    
    expect(detector.detect(button)).toBe('Shadow Button');
  });
});
```

---

## 10. Performance Optimization

### 10.1 Caching

```typescript
class CachedLabelDetector {
  private detector: LabelDetector;
  private cache: WeakMap<HTMLElement, string> = new WeakMap();
  
  constructor(config?: Partial<LabelDetectorConfig>) {
    this.detector = new LabelDetector(config);
  }
  
  detect(element: HTMLElement): string {
    // Check cache
    const cached = this.cache.get(element);
    if (cached) {
      return cached;
    }
    
    // Detect and cache
    const label = this.detector.detect(element);
    this.cache.set(element, label);
    
    return label;
  }
  
  clearCache() {
    this.cache = new WeakMap();
  }
}
```

### 10.2 Lazy Evaluation

```typescript
class LazyLabelDetector {
  private heuristics: LabelHeuristic[];
  
  detect(element: HTMLElement): string {
    // Try heuristics one at a time, stopping when found
    for (const heuristic of this.heuristics) {
      const result = heuristic.detect(element);
      
      if (result && result.trim().length > 0) {
        // Found! Don't evaluate remaining heuristics
        return this.sanitize(result);
      }
    }
    
    return this.fallback(element);
  }
}
```

### 10.3 Batch Detection

```typescript
class BatchLabelDetector {
  private detector: LabelDetector;
  
  detectBatch(elements: HTMLElement[]): Map<HTMLElement, string> {
    const results = new Map<HTMLElement, string>();
    
    // Process in batches to avoid blocking
    const batchSize = 50;
    
    for (let i = 0; i < elements.length; i += batchSize) {
      const batch = elements.slice(i, i + batchSize);
      
      batch.forEach(element => {
        const label = this.detector.detect(element);
        results.set(element, label);
      });
    }
    
    return results;
  }
}
```

---

## Summary

The Label Detection System provides:

✅ 12 heuristics ordered by priority  
✅ Comprehensive implementation of each heuristic  
✅ Label sanitization with length limits, whitespace normalization  
✅ Element-specific strategies for inputs, buttons, links, selects  
✅ Fallback strategies using context and position  
✅ Flexible configuration for all aspects of detection  
✅ Comprehensive testing with unit and integration tests  
✅ Performance optimizations with caching and lazy evaluation

The label detection system ensures every recorded step has a meaningful, human-readable description that improves test readability and maintainability.
