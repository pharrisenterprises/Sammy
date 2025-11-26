# Framework Adapters
**Project:** Chrome Extension Test Recorder  
**Document Version:** 1.0  
**Last Updated:** November 24, 2025  
**Status:** Complete Technical Specification

## Table of Contents
1. Overview
2. Adapter Architecture
3. React Adapter
4. Vue Adapter
5. Angular Adapter
6. jQuery Adapter
7. Select2 Adapter
8. Draft.js Adapter
9. Google Autocomplete Adapter
10. Custom Component Detection
11. Adapter Registry
12. Testing Adapters

---

## 1. Overview

### 1.1 Purpose

Framework Adapters handle the unique behaviors of different JavaScript frameworks and UI component libraries. Each adapter encapsulates framework-specific logic for setting values, triggering events, and interacting with custom components.

### 1.2 Why Adapters Are Needed

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       THE FRAMEWORK PROBLEM                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  VANILLA JAVASCRIPT                                                     │
│  element.value = "text"; // Works!                                      │
│  element.dispatchEvent(new Event('change')); // Works!                  │
│                                                                         │
│  REACT CONTROLLED INPUT                                                 │
│  element.value = "text"; // Sets DOM value but...                       │
│  // React state is NOT updated                                          │
│  // Component shows old value after re-render                           │
│  // onChange handler NOT called                                         │
│                                                                         │
│  VUE v-model                                                            │
│  element.value = "text"; // Sets DOM value but...                       │
│  // Vue data binding NOT triggered                                      │
│  // Watchers NOT notified                                               │
│                                                                         │
│  SELECT2 CUSTOM DROPDOWN                                                │
│  select.value = "option1"; // Sets hidden select but...                 │
│  // Visual UI NOT updated                                               │
│  // Select2 internal state NOT synced                                   │
│                                                                         │
│  SOLUTION: Framework-specific adapters that understand internals        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Adapter Interface

```typescript
interface FrameworkAdapter {
  // Identification
  name: string;
  detect(element: HTMLElement): boolean;
  
  // Actions
  setValue(element: HTMLElement, value: string): Promise<boolean>;
  click(element: HTMLElement): Promise<boolean>;
  focus(element: HTMLElement): Promise<boolean>;
  blur(element: HTMLElement): Promise<boolean>;
  
  // Optional specialized actions
  select?(element: HTMLElement, optionValue: string): Promise<boolean>;
  clear?(element: HTMLElement): Promise<boolean>;
}
```

---

## 2. Adapter Architecture

### 2.1 Adapter Selection Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ADAPTER SELECTION FLOW                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Element to interact with                                               │
│           │                                                             │
│           ▼                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │              ADAPTER REGISTRY                                   │   │
│  │  ┌─────────────────────────────────────────────────────────┐   │   │
│  │  │  For each registered adapter (priority order):          │   │   │
│  │  │    if adapter.detect(element) → return adapter          │   │   │
│  │  └─────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│           │                                                             │
│           ▼                                                             │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐              │
│  │  Select2    │     │   Draft.js  │     │   Google    │              │
│  │  Adapter    │     │   Adapter   │     │ Autocomplete│              │
│  └─────────────┘     └─────────────┘     └─────────────┘              │
│           │                 │                   │                      │
│           └─────────────────┼───────────────────┘                      │
│                             ▼                                          │
│                    No match found?                                     │
│                             │                                          │
│                             ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │              DEFAULT ADAPTER                                    │   │
│  │  (React-safe with native property descriptor)                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Priority Order

| Priority | Adapter | Reason |
|----------|---------|--------|
| 1 | Google Autocomplete | Requires page-context delegation |
| 2 | Select2 | Custom dropdown, needs original select |
| 3 | Draft.js | Uses execCommand, not standard input |
| 4 | React | Most common framework |
| 5 | Vue | Similar to React but different detection |
| 6 | Angular | Zone.js considerations |
| 7 | jQuery | Legacy support |
| 8 | Default | Fallback with native setter |

---

## 3. React Adapter

### 3.1 Detection Logic

```typescript
const ReactAdapter: FrameworkAdapter = {
  name: 'react',
  
  detect(element: HTMLElement): boolean {
    // Check for React fiber node
    const fiberKey = Object.keys(element).find(key =>
      key.startsWith('__reactFiber$') ||
      key.startsWith('__reactInternalInstance$') ||
      key.startsWith('__reactProps$')
    );
    
    if (fiberKey) return true;
    
    // Check for React root
    const root = element.closest('[data-reactroot]');
    if (root) return true;
    
    // Check for common React patterns
    const hasReactId = element.hasAttribute('data-reactid');
    if (hasReactId) return true;
    
    // Check parent for React markers
    let current = element.parentElement;
    while (current) {
      const parentFiberKey = Object.keys(current).find(key =>
        key.startsWith('__reactFiber$')
      );
      if (parentFiberKey) return true;
      current = current.parentElement;
    }
    
    return false;
  }
};
```

### 3.2 Value Setting

```typescript
const ReactAdapter: FrameworkAdapter = {
  // ... detection
  
  async setValue(element: HTMLElement, value: string): Promise<boolean> {
    const input = element as HTMLInputElement;
    
    // Focus first
    input.focus();
    
    // Get native setter to bypass React's controlled input
    const prototype = input instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
    const nativeSetter = descriptor?.set;
    
    if (!nativeSetter) {
      console.warn('Native value setter not found');
      input.value = value;
    } else {
      nativeSetter.call(input, value);
    }
    
    // Dispatch events that React listens to
    // React 16 uses SyntheticEvent from input event
    // React 17+ also uses native events
    
    const inputEvent = new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: value
    });
    
    input.dispatchEvent(inputEvent);
    
    // Also dispatch change for controlled components
    const changeEvent = new Event('change', {
      bubbles: true,
      cancelable: true
    });
    
    input.dispatchEvent(changeEvent);
    
    return true;
  },
  
  async click(element: HTMLElement): Promise<boolean> {
    // React uses synthetic events, but native events also work
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    
    const eventInit: MouseEventInit = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: x,
      clientY: y
    };
    
    // Dispatch full event sequence
    element.dispatchEvent(new MouseEvent('mousedown', eventInit));
    element.focus();
    element.dispatchEvent(new MouseEvent('mouseup', eventInit));
    element.dispatchEvent(new MouseEvent('click', eventInit));
    
    return true;
  },
  
  async focus(element: HTMLElement): Promise<boolean> {
    element.focus();
    element.dispatchEvent(new FocusEvent('focus', { bubbles: false }));
    element.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    return true;
  },
  
  async blur(element: HTMLElement): Promise<boolean> {
    element.blur();
    element.dispatchEvent(new FocusEvent('blur', { bubbles: false }));
    element.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    return true;
  }
};
```

### 3.3 React-Specific Considerations

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    REACT CONSIDERATIONS                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  CONTROLLED vs UNCONTROLLED INPUTS                                      │
│  ├── Controlled: value prop + onChange handler                          │
│  │   - MUST use native setter + input event                            │
│  │   - Direct value assignment causes desync                           │
│  │                                                                      │
│  └── Uncontrolled: defaultValue + ref                                   │
│      - Direct value assignment works                                    │
│      - But native setter approach also works                            │
│                                                                         │
│  REACT STRICT MODE (Development)                                        │
│  ├── Double-renders components                                          │
│  ├── May cause timing issues                                            │
│  └── Add small delay after value set if issues occur                    │
│                                                                         │
│  REACT 18 CONCURRENT MODE                                               │
│  ├── Renders may be interrupted                                         │
│  ├── State updates may be batched                                       │
│  └── Events are still processed synchronously                           │
│                                                                         │
│  SYNTHETIC EVENTS                                                       │
│  ├── React wraps native events                                          │
│  ├── Native events bubble up and trigger handlers                       │
│  └── InputEvent with bubbles:true is sufficient                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Vue Adapter

### 4.1 Detection Logic

```typescript
const VueAdapter: FrameworkAdapter = {
  name: 'vue',
  
  detect(element: HTMLElement): boolean {
    // Vue 3: Check for __vueParentComponent
    if ('__vueParentComponent' in element) return true;
    
    // Vue 2: Check for __vue__
    if ('__vue__' in element) return true;
    
    // Check parent elements for Vue instance
    let current = element.parentElement;
    while (current) {
      if ('__vue__' in current || '__vueParentComponent' in current) {
        return true;
      }
      current = current.parentElement;
    }
    
    // Check for v-model directive markers
    const hasVModel = element.hasAttribute('v-model') ||
      element.className.includes('v-') ||
      element.closest('[data-v-]') !== null;
    
    return hasVModel;
  }
};
```

### 4.2 Value Setting

```typescript
const VueAdapter: FrameworkAdapter = {
  // ... detection
  
  async setValue(element: HTMLElement, value: string): Promise<boolean> {
    const input = element as HTMLInputElement;
    
    // Focus
    input.focus();
    
    // Use native setter (same approach as React)
    const prototype = input instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
    const nativeSetter = descriptor?.set;
    
    if (nativeSetter) {
      nativeSetter.call(input, value);
    } else {
      input.value = value;
    }
    
    // Vue v-model listens to input event
    input.dispatchEvent(new Event('input', { bubbles: true }));
    
    // v-model.lazy listens to change event
    input.dispatchEvent(new Event('change', { bubbles: true }));
    
    // Trigger Vue's reactivity system
    // The input event should be sufficient, but we can also
    // trigger a compositionend for IME support
    input.dispatchEvent(new CompositionEvent('compositionend', {
      bubbles: true,
      data: value
    }));
    
    return true;
  },
  
  async click(element: HTMLElement): Promise<boolean> {
    // Standard click works for Vue
    const rect = element.getBoundingClientRect();
    
    element.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2
    }));
    
    element.focus();
    
    element.dispatchEvent(new MouseEvent('mouseup', {
      bubbles: true,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2
    }));
    
    element.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2
    }));
    
    return true;
  },
  
  async focus(element: HTMLElement): Promise<boolean> {
    element.focus();
    return true;
  },
  
  async blur(element: HTMLElement): Promise<boolean> {
    element.blur();
    // Vue may have @blur handlers
    element.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    return true;
  }
};
```

### 4.3 Vue-Specific Modifiers

```typescript
// Handle Vue v-model modifiers
async function setVueValueWithModifiers(
  element: HTMLInputElement,
  value: string
): Promise<boolean> {
  // Check for v-model.number
  const isNumber = element.hasAttribute('v-model.number') ||
    element.type === 'number';
  
  // Check for v-model.trim
  const isTrim = element.hasAttribute('v-model.trim');
  
  // Check for v-model.lazy
  const isLazy = element.hasAttribute('v-model.lazy');
  
  let processedValue = value;
  
  if (isTrim) {
    processedValue = value.trim();
  }
  
  // Set value
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype, 'value'
  )?.set;
  
  if (setter) {
    setter.call(element, processedValue);
  }
  
  // Dispatch appropriate event
  if (isLazy) {
    // v-model.lazy only updates on change
    element.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }
  
  return true;
}
```

---

## 5. Angular Adapter

### 5.1 Detection Logic

```typescript
const AngularAdapter: FrameworkAdapter = {
  name: 'angular',
  
  detect(element: HTMLElement): boolean {
    // Check for ng- attributes (Angular 1.x)
    const hasNgAttribute = Array.from(element.attributes).some(attr =>
      attr.name.startsWith('ng-') || attr.name.startsWith('data-ng-')
    );
    if (hasNgAttribute) return true;
    
    // Check for _ngcontent attribute (Angular 2+)
    const hasNgContent = Array.from(element.attributes).some(attr =>
      attr.name.startsWith('_ngcontent') || attr.name.startsWith('_nghost')
    );
    if (hasNgContent) return true;
    
    // Check for [ngModel] or [(ngModel)]
    const hasNgModel = element.hasAttribute('ng-model') ||
      element.hasAttribute('ngmodel') ||
      element.getAttribute('ng-reflect-model') !== null;
    if (hasNgModel) return true;
    
    // Check for Angular app root
    const appRoot = document.querySelector('app-root, [ng-app]');
    if (appRoot && appRoot.contains(element)) return true;
    
    return false;
  }
};
```

### 5.2 Value Setting

```typescript
const AngularAdapter: FrameworkAdapter = {
  // ... detection
  
  async setValue(element: HTMLElement, value: string): Promise<boolean> {
    const input = element as HTMLInputElement;
    
    // Focus
    input.focus();
    
    // Set value using native setter
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype, 'value'
    )?.set;
    
    if (setter) {
      setter.call(input, value);
    } else {
      input.value = value;
    }
    
    // Angular uses zone.js for change detection
    // Dispatching input event triggers the zone
    
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    
    // For Angular reactive forms, may need to trigger blur
    // to complete validation
    input.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    
    return true;
  },
  
  async click(element: HTMLElement): Promise<boolean> {
    // Angular handles standard click events
    element.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    }));
    
    return true;
  },
  
  async focus(element: HTMLElement): Promise<boolean> {
    element.focus();
    // Angular may have (focus) handler
    element.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    return true;
  },
  
  async blur(element: HTMLElement): Promise<boolean> {
    element.blur();
    // Angular validation often triggers on blur
    element.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    return true;
  }
};
```

### 5.3 Angular-Specific Considerations

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ANGULAR CONSIDERATIONS                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ZONE.JS                                                                │
│  ├── Angular uses zone.js to detect async operations                    │
│  ├── Events dispatched are automatically detected                       │
│  └── Change detection runs after event handlers complete                │
│                                                                         │
│  REACTIVE FORMS vs TEMPLATE-DRIVEN                                      │
│  ├── Both respond to input/change events                                │
│  ├── Reactive forms may need explicit updateValueAndValidity()          │
│  └── Our approach works for both                                        │
│                                                                         │
│  VALIDATION                                                             │
│  ├── Often runs on blur                                                 │
│  ├── Make sure to dispatch blur after input                             │
│  └── Async validators may need additional delay                         │
│                                                                         │
│  MATERIAL COMPONENTS                                                    │
│  ├── Mat-input wraps native input                                       │
│  ├── Need to target the inner <input> element                           │
│  └── Mat-select is custom component (needs special handling)            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 6. jQuery Adapter

### 6.1 Detection Logic

```typescript
const jQueryAdapter: FrameworkAdapter = {
  name: 'jquery',
  
  detect(element: HTMLElement): boolean {
    // Check if jQuery is loaded
    if (typeof (window as any).jQuery === 'undefined' &&
        typeof (window as any).$ === 'undefined') {
      return false;
    }
    
    const $ = (window as any).jQuery || (window as any).$;
    
    // Check if element has jQuery data
    try {
      const $el = $(element);
      const events = $._data ? $._data(element, 'events') : null;
      
      // Has jQuery event handlers
      if (events && Object.keys(events).length > 0) {
        return true;
      }
      
      // Has jQuery data
      if ($el.data() && Object.keys($el.data()).length > 0) {
        return true;
      }
    } catch (e) {
      // jQuery not properly loaded or element not in jQuery context
    }
    
    return false;
  }
};
```

### 6.2 Value Setting

```typescript
const jQueryAdapter: FrameworkAdapter = {
  // ... detection
  
  async setValue(element: HTMLElement, value: string): Promise<boolean> {
    const input = element as HTMLInputElement;
    const $ = (window as any).jQuery || (window as any).$;
    
    // Focus using jQuery
    $(input).focus();
    
    // Set value using jQuery's val() method
    // This properly triggers jQuery's change detection
    $(input).val(value);
    
    // Trigger jQuery events
    $(input).trigger('input');
    $(input).trigger('change');
    
    // Also dispatch native events for non-jQuery listeners
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    
    return true;
  },
  
  async click(element: HTMLElement): Promise<boolean> {
    const $ = (window as any).jQuery || (window as any).$;
    
    // Use jQuery's trigger for bound handlers
    $(element).trigger('click');
    
    // Also dispatch native event
    element.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true
    }));
    
    return true;
  },
  
  async focus(element: HTMLElement): Promise<boolean> {
    const $ = (window as any).jQuery || (window as any).$;
    $(element).focus();
    $(element).trigger('focus');
    return true;
  },
  
  async blur(element: HTMLElement): Promise<boolean> {
    const $ = (window as any).jQuery || (window as any).$;
    $(element).blur();
    $(element).trigger('blur');
    return true;
  }
};
```

---

## 7. Select2 Adapter

### 7.1 Detection Logic

```typescript
const Select2Adapter: FrameworkAdapter = {
  name: 'select2',
  
  detect(element: HTMLElement): boolean {
    // Check for Select2 classes
    if (element.classList.contains('select2-hidden-accessible')) {
      return true;
    }
    
    if (element.classList.contains('select2-selection')) {
      return true;
    }
    
    // Check if element is inside Select2 container
    if (element.closest('.select2-container')) {
      return true;
    }
    
    // Check for Select2 data attribute
    if (element.hasAttribute('data-select2-id')) {
      return true;
    }
    
    // Check if this is a select with Select2 initialized
    if (element.tagName === 'SELECT') {
      const $el = (window as any).jQuery?.(element);
      if ($el?.data('select2')) {
        return true;
      }
    }
    
    return false;
  }
};
```

### 7.2 Select2 Value Setting

```typescript
const Select2Adapter: FrameworkAdapter = {
  // ... detection
  
  async setValue(element: HTMLElement, value: string): Promise<boolean> {
    // Find the original select element
    const originalSelect = this.findOriginalSelect(element);
    
    if (!originalSelect) {
      console.warn('Select2: Could not find original select');
      return false;
    }
    
    const $ = (window as any).jQuery;
    if (!$) {
      console.warn('Select2: jQuery not available');
      return false;
    }
    
    const $select = $(originalSelect);
    
    // Find the option to select
    const options = Array.from(originalSelect.options);
    let targetOption = options.find(opt => opt.value === value);
    
    if (!targetOption) {
      // Try text match
      targetOption = options.find(opt =>
        opt.textContent?.toLowerCase().includes(value.toLowerCase())
      );
    }
    
    if (!targetOption) {
      console.warn(`Select2: Option not found for value: ${value}`);
      return false;
    }
    
    // Set the value using Select2's API
    $select.val(targetOption.value);
    
    // Trigger Select2's change event
    $select.trigger('change');
    
    // Also trigger select2:select for custom handlers
    $select.trigger({
      type: 'select2:select',
      params: {
        data: {
          id: targetOption.value,
          text: targetOption.textContent
        }
      }
    });
    
    return true;
  },
  
  findOriginalSelect(element: HTMLElement): HTMLSelectElement | null {
    // If element is the select itself
    if (element.tagName === 'SELECT') {
      return element as HTMLSelectElement;
    }
    
    // Find container
    const container = element.closest('.select2-container');
    
    if (container) {
      // Original select is typically previous sibling
      const prev = container.previousElementSibling;
      if (prev?.tagName === 'SELECT') {
        return prev as HTMLSelectElement;
      }
      
      // Or check for data-select2-id
      const selectId = container.getAttribute('data-select2-id');
      if (selectId) {
        // Find select by matching data attribute
        const select = document.querySelector(
          `select[data-select2-id="${selectId}"]`
        ) as HTMLSelectElement;
        if (select) return select;
      }
    }
    
    // Try finding by ID pattern
    const id = element.id || element.getAttribute('aria-controls') || '';
    const possibleSelectId = id
      .replace('select2-', '')
      .replace('-container', '')
      .replace('-results', '')
      .replace('-listbox', '');
    
    if (possibleSelectId) {
      const select = document.getElementById(possibleSelectId) as HTMLSelectElement;
      if (select?.tagName === 'SELECT') {
        return select;
      }
    }
    
    return null;
  },
  
  async click(element: HTMLElement): Promise<boolean> {
    // Clicking Select2 opens/closes dropdown
    const container = element.closest('.select2-container') || element;
    
    // Dispatch click to open dropdown
    container.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    container.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    
    return true;
  },
  
  async select(element: HTMLElement, optionValue: string): Promise<boolean> {
    return this.setValue(element, optionValue);
  },
  
  async focus(element: HTMLElement): Promise<boolean> {
    const container = element.closest('.select2-container');
    if (container) {
      (container as HTMLElement).focus();
    }
    return true;
  },
  
  async blur(element: HTMLElement): Promise<boolean> {
    const $ = (window as any).jQuery;
    if ($) {
      const originalSelect = this.findOriginalSelect(element);
      if (originalSelect) {
        $(originalSelect).select2('close');
      }
    }
    return true;
  }
};
```

---

## 8. Draft.js Adapter

### 8.1 Detection Logic

```typescript
const DraftJsAdapter: FrameworkAdapter = {
  name: 'draftjs',
  
  detect(element: HTMLElement): boolean {
    // Check for Draft.js editor class
    if (element.classList.contains('DraftEditor-root') ||
        element.classList.contains('DraftEditor-editorContainer') ||
        element.classList.contains('public-DraftEditor-content')) {
      return true;
    }
    
    // Check for Draft.js parent
    if (element.closest('.DraftEditor-root')) {
      return true;
    }
    
    // Check for contenteditable with Draft.js patterns
    if (element.isContentEditable) {
      // Twitter/X uses Draft.js
      if (element.closest('[data-testid="tweetTextarea"]')) {
        return true;
      }
      
      // Facebook uses Draft.js
      if (element.closest('[data-contents="true"]')) {
        return true;
      }
      
      // Generic Draft.js pattern: contenteditable with placeholder
      if (element.id?.includes('placeholder') ||
          element.getAttribute('data-placeholder')) {
        return true;
      }
    }
    
    return false;
  }
};
```

### 8.2 Draft.js Value Setting

```typescript
const DraftJsAdapter: FrameworkAdapter = {
  // ... detection
  
  async setValue(element: HTMLElement, value: string): Promise<boolean> {
    // Find the editable element
    let editable = element;
    
    if (!element.isContentEditable) {
      const editableChild = element.querySelector('[contenteditable="true"]');
      if (editableChild) {
        editable = editableChild as HTMLElement;
      }
    }
    
    // Focus the editor
    editable.focus();
    
    // Select all existing content
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editable);
    selection?.removeAllRanges();
    selection?.addRange(range);
    
    // Draft.js requires execCommand for proper state sync
    const success = document.execCommand('insertText', false, value);
    
    if (!success) {
      // Fallback: direct text manipulation
      // This may not sync Draft.js state properly
      console.warn('Draft.js: execCommand failed, using fallback');
      
      // Clear content
      editable.innerHTML = '';
      
      // Insert text
      const textNode = document.createTextNode(value);
      editable.appendChild(textNode);
      
      // Move cursor to end
      range.selectNodeContents(editable);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
    
    // Dispatch input event
    editable.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      inputType: 'insertText',
      data: value
    }));
    
    return true;
  },
  
  async click(element: HTMLElement): Promise<boolean> {
    element.focus();
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return true;
  },
  
  async focus(element: HTMLElement): Promise<boolean> {
    let editable = element;
    if (!element.isContentEditable) {
      const editableChild = element.querySelector('[contenteditable="true"]');
      if (editableChild) {
        editable = editableChild as HTMLElement;
      }
    }
    editable.focus();
    return true;
  },
  
  async blur(element: HTMLElement): Promise<boolean> {
    element.blur();
    return true;
  },
  
  async clear(element: HTMLElement): Promise<boolean> {
    let editable = element;
    if (!element.isContentEditable) {
      const editableChild = element.querySelector('[contenteditable="true"]');
      if (editableChild) {
        editable = editableChild as HTMLElement;
      }
    }
    
    editable.focus();
    
    // Select all and delete
    document.execCommand('selectAll', false);
    document.execCommand('delete', false);
    
    return true;
  }
};
```

---

## 9. Google Autocomplete Adapter

### 9.1 Detection Logic

```typescript
const GoogleAutocompleteAdapter: FrameworkAdapter = {
  name: 'google-autocomplete',
  
  detect(element: HTMLElement): boolean {
    // Check for Google Maps Place Autocomplete
    if (element.tagName.toLowerCase() === 'gmp-place-autocomplete') {
      return true;
    }
    
    // Check if inside Google autocomplete
    if (element.closest('gmp-place-autocomplete')) {
      return true;
    }
    
    // Check for Google Places API classes
    if (element.classList.contains('pac-container') ||
        element.classList.contains('pac-item')) {
      return true;
    }
    
    // Check for shadow host patterns from bundle
    // (This would be passed via context)
    
    return false;
  }
};
```

### 9.2 Google Autocomplete Delegation

```typescript
const GoogleAutocompleteAdapter: FrameworkAdapter = {
  // ... detection
  
  async setValue(
    element: HTMLElement,
    value: string,
    bundle?: LocatorBundle
  ): Promise<boolean> {
    // Google Autocomplete uses closed shadow DOM
    // Must delegate to page-context script
    
    window.postMessage({
      type: 'REPLAY_AUTOCOMPLETE',
      action: 'AUTOCOMPLETE_INPUT',
      bundle: bundle || this.createBundleFromElement(element),
      value: value
    }, '*');
    
    // Return true - actual execution happens in page context
    // Errors will be logged by page script
    return true;
  },
  
  async click(
    element: HTMLElement,
    bundle?: LocatorBundle
  ): Promise<boolean> {
    // Delegate selection click to page context
    window.postMessage({
      type: 'REPLAY_AUTOCOMPLETE',
      action: 'AUTOCOMPLETE_SELECTION',
      bundle: bundle || this.createBundleFromElement(element)
    }, '*');
    
    return true;
  },
  
  async select(
    element: HTMLElement,
    optionValue: string,
    bundle?: LocatorBundle
  ): Promise<boolean> {
    window.postMessage({
      type: 'REPLAY_AUTOCOMPLETE',
      action: 'AUTOCOMPLETE_SELECTION',
      bundle: bundle || this.createBundleFromElement(element),
      value: optionValue
    }, '*');
    
    return true;
  },
  
  createBundleFromElement(element: HTMLElement): Partial<LocatorBundle> {
    // Create minimal bundle for page script
    const host = element.closest('gmp-place-autocomplete');
    
    return {
      xpath: this.getXPath(element),
      hostXPath: host ? this.getXPath(host) : undefined,
      shadowHosts: host ? [this.getXPath(host)] : []
    };
  },
  
  getXPath(element: Element): string {
    // Simple XPath generation
    const parts: string[] = [];
    let current: Element | null = element;
    
    while (current && current !== document.body) {
      let index = 1;
      let sibling = current.previousElementSibling;
      
      while (sibling) {
        if (sibling.tagName === current.tagName) {
          index++;
        }
        sibling = sibling.previousElementSibling;
      }
      
      const tag = current.tagName.toLowerCase();
      parts.unshift(`${tag}[${index}]`);
      current = current.parentElement;
    }
    
    return '//' + parts.join('/');
  },
  
  async focus(element: HTMLElement): Promise<boolean> {
    // Focus the host element
    const host = element.closest('gmp-place-autocomplete') || element;
    (host as HTMLElement).focus();
    return true;
  },
  
  async blur(element: HTMLElement): Promise<boolean> {
    const host = element.closest('gmp-place-autocomplete') || element;
    (host as HTMLElement).blur();
    return true;
  }
};
```

---

## 10. Custom Component Detection

### 10.1 Generic Custom Element Detection

```typescript
function isCustomElement(element: HTMLElement): boolean {
  // Check if tag name contains hyphen (custom element spec)
  return element.tagName.includes('-');
}

function detectComponentLibrary(element: HTMLElement): string | null {
  // Material UI
  if (element.classList.toString().includes('Mui') ||
      element.classList.toString().includes('MuiInput')) {
    return 'material-ui';
  }
  
  // Ant Design
  if (element.classList.toString().includes('ant-')) {
    return 'antd';
  }
  
  // Bootstrap
  if (element.classList.contains('form-control') ||
      element.classList.contains('btn')) {
    return 'bootstrap';
  }
  
  // Semantic UI
  if (element.classList.contains('ui') &&
      (element.classList.contains('input') ||
       element.classList.contains('dropdown'))) {
    return 'semantic-ui';
  }
  
  // Chakra UI
  if (element.hasAttribute('data-chakra-component')) {
    return 'chakra-ui';
  }
  
  return null;
}
```

### 10.2 Component Library Handlers

```typescript
const componentHandlers: Record<string, (element: HTMLElement, value: string) => Promise<boolean>> = {
  'material-ui': async (element, value) => {
    // Material UI wraps inputs
    const input = element.querySelector('input') || element;
    return ReactAdapter.setValue(input as HTMLElement, value);
  },
  
  'antd': async (element, value) => {
    // Ant Design also uses React
    const input = element.querySelector('input, textarea') || element;
    return ReactAdapter.setValue(input as HTMLElement, value);
  },
  
  'bootstrap': async (element, value) => {
    // Bootstrap uses standard inputs
    const input = element as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  },
  
  'semantic-ui': async (element, value) => {
    // Semantic UI dropdowns need special handling
    const $ = (window as any).jQuery;
    if ($ && element.classList.contains('dropdown')) {
      $(element).dropdown('set selected', value);
      return true;
    }
    // Standard input
    const input = element.querySelector('input') || element;
    (input as HTMLInputElement).value = value;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
};
```

---

## 11. Adapter Registry

### 11.1 Registry Implementation

```typescript
class AdapterRegistry {
  private adapters: FrameworkAdapter[] = [];
  private defaultAdapter: FrameworkAdapter;
  
  constructor() {
    // Register adapters in priority order
    this.register(GoogleAutocompleteAdapter);
    this.register(Select2Adapter);
    this.register(DraftJsAdapter);
    this.register(ReactAdapter);
    this.register(VueAdapter);
    this.register(AngularAdapter);
    this.register(jQueryAdapter);
    
    // Default adapter uses React-safe approach
    this.defaultAdapter = this.createDefaultAdapter();
  }
  
  register(adapter: FrameworkAdapter): void {
    this.adapters.push(adapter);
  }
  
  getAdapter(element: HTMLElement): FrameworkAdapter {
    for (const adapter of this.adapters) {
      if (adapter.detect(element)) {
        console.debug(`Using ${adapter.name} adapter for element`);
        return adapter;
      }
    }
    
    return this.defaultAdapter;
  }
  
  private createDefaultAdapter(): FrameworkAdapter {
    return {
      name: 'default',
      
      detect: () => true,
      
      async setValue(element: HTMLElement, value: string): Promise<boolean> {
        const input = element as HTMLInputElement;
        
        input.focus();
        
        // Use native setter (works for most frameworks)
        const setter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype, 'value'
        )?.set;
        
        if (setter) {
          setter.call(input, value);
        } else {
          input.value = value;
        }
        
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        
        return true;
      },
      
      async click(element: HTMLElement): Promise<boolean> {
        element.dispatchEvent(new MouseEvent('click', {
          bubbles: true,
          cancelable: true
        }));
        return true;
      },
      
      async focus(element: HTMLElement): Promise<boolean> {
        element.focus();
        return true;
      },
      
      async blur(element: HTMLElement): Promise<boolean> {
        element.blur();
        return true;
      }
    };
  }
}

// Global registry instance
const adapterRegistry = new AdapterRegistry();
```

### 11.2 Using the Registry

```typescript
async function executeAdaptedAction(
  element: HTMLElement,
  action: 'setValue' | 'click' | 'focus' | 'blur',
  value?: string
): Promise<boolean> {
  const adapter = adapterRegistry.getAdapter(element);
  
  switch (action) {
    case 'setValue':
      return adapter.setValue(element, value!);
    case 'click':
      return adapter.click(element);
    case 'focus':
      return adapter.focus(element);
    case 'blur':
      return adapter.blur(element);
    default:
      return false;
  }
}
```

---

## 12. Testing Adapters

### 12.1 Adapter Test Suite

```typescript
interface AdapterTestCase {
  name: string;
  html: string;
  expectedAdapter: string;
  testAction: 'setValue' | 'click';
  testValue?: string;
  expectedResult: boolean;
}

const adapterTestCases: AdapterTestCase[] = [
  {
    name: 'React controlled input',
    html: '<input type="text" id="react-input">',
    expectedAdapter: 'react',
    testAction: 'setValue',
    testValue: 'test value',
    expectedResult: true
  },
  {
    name: 'Select2 dropdown',
    html: '<select class="select2-hidden-accessible"><option value="1">One</option></select>',
    expectedAdapter: 'select2',
    testAction: 'setValue',
    testValue: '1',
    expectedResult: true
  },
  {
    name: 'Draft.js editor',
    html: '<div class="DraftEditor-root"><div contenteditable="true"></div></div>',
    expectedAdapter: 'draftjs',
    testAction: 'setValue',
    testValue: 'draft text',
    expectedResult: true
  }
];

async function runAdapterTests(): Promise<void> {
  for (const testCase of adapterTestCases) {
    console.log(`Testing: ${testCase.name}`);
    
    // Create test element
    const container = document.createElement('div');
    container.innerHTML = testCase.html;
    document.body.appendChild(container);
    
    const element = container.firstElementChild as HTMLElement;
    
    // Get adapter
    const adapter = adapterRegistry.getAdapter(element);
    console.log(`  Detected adapter: ${adapter.name}`);
    console.assert(
      adapter.name === testCase.expectedAdapter,
      `Expected ${testCase.expectedAdapter}, got ${adapter.name}`
    );
    
    // Test action
    let result: boolean;
    if (testCase.testAction === 'setValue') {
      result = await adapter.setValue(element, testCase.testValue!);
    } else {
      result = await adapter.click(element);
    }
    
    console.log(`  Action result: ${result}`);
    console.assert(
      result === testCase.expectedResult,
      `Expected ${testCase.expectedResult}, got ${result}`
    );
    
    // Cleanup
    container.remove();
  }
}
```

---

## Summary

The Framework Adapters system provides:

✅ Automatic framework detection for React, Vue, Angular, jQuery  
✅ Specialized handlers for Select2, Draft.js, Google Autocomplete  
✅ Priority-based adapter selection ensuring correct handler  
✅ Native property descriptor approach working across frameworks  
✅ Page-context delegation for closed shadow DOM components  
✅ Component library detection for Material UI, Ant Design, etc.  
✅ Extensible registry for adding custom adapters  
✅ Fallback default adapter for unknown frameworks

This system ensures reliable interaction with any web application regardless of the underlying framework or component library.
