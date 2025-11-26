# Action Execution System
**Project:** Chrome Extension Test Recorder  
**Document Version:** 1.0  
**Last Updated:** November 24, 2025  
**Status:** Complete Technical Specification

## Table of Contents
1. Overview
2. Action Types
3. Click Execution
4. Input Execution
5. Enter/Submit Execution
6. Human-Like Event Sequences
7. Framework-Specific Handlers
8. Visibility Management
9. Value Injection Patterns
10. Event Dispatching
11. Error Handling
12. Timing and Delays
13. Special Cases

---

## 1. Overview

### 1.1 Purpose

The Action Execution System takes located DOM elements and performs recorded user interactions on them. It must handle framework-specific behaviors, dispatch realistic event sequences, and manage element visibility during execution.

### 1.2 Action Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       ACTION EXECUTION FLOW                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                     │
│  │   Element   │  │ Visibility  │  │   Action    │                     │
│  │    Found    │─▶│    Check    │─▶│  Dispatch   │                     │
│  └─────────────┘  └─────────────┘  └─────────────┘                     │
│         │                 │                                             │
│         ▼                 ▼                                             │
│  ┌─────────────┐  ┌─────────────┐                                      │
│  │ Temporary   │  │    Event    │                                      │
│  │    Show     │  │  Sequence   │                                      │
│  └─────────────┘  └─────────────┘                                      │
│         │                 │                                             │
│         │                 ▼                                             │
│         │         ┌─────────────┐                                       │
│         │         │ Framework   │                                       │
│         │         │  Handlers   │                                       │
│         │         └─────────────┘                                       │
│         │                 │                                             │
│         ▼                 ▼                                             │
│  ┌─────────────┐  ┌─────────────┐                                      │
│  │   Restore   │  │   Return    │                                      │
│  │ Visibility  │  │   Result    │                                      │
│  └─────────────┘  └─────────────┘                                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Core Function Signature

```typescript
async function playAction(
  bundle: LocatorBundle,
  action: ActionType,
  value?: string
): Promise<boolean> {
  // 1. Find element
  const element = await findElementFromBundle(bundle);
  if (!element) return false;
  
  // 2. Ensure visibility
  const restore = temporarilyShow(element);
  
  try {
    // 3. Execute action
    switch (action) {
      case 'click':
        return await executeClick(element, value, bundle);
      case 'input':
        return await executeInput(element, value!, bundle);
      case 'enter':
        return await executeEnter(element, value, bundle);
      default:
        console.warn(`Unknown action: ${action}`);
        return false;
    }
  } finally {
    // 4. Restore visibility
    restore();
  }
}

type ActionType = 'click' | 'input' | 'enter';
```

---

## 2. Action Types

### 2.1 Supported Actions

| Action | Description | Value Required | Common Elements |
|--------|-------------|----------------|-----------------|
| click | Mouse click interaction | Optional (for radio/select) | Buttons, links, checkboxes |
| input | Text entry into field | Required | Input, textarea, contenteditable |
| enter | Keyboard Enter press | Optional (pre-fill value) | Search fields, forms |

### 2.2 Action Decision Tree

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      ACTION ROUTING LOGIC                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  action === 'click'                                                     │
│  ├── Is radio/checkbox group? ──▶ executeRadioCheckboxClick()          │
│  ├── Is <select> element? ──────▶ executeSelectChange()                │
│  ├── Is Google Autocomplete? ───▶ delegateToPageScript()               │
│  └── Default ───────────────────▶ humanClick()                         │
│                                                                         │
│  action === 'input'                                                     │
│  ├── Is contenteditable? ───────▶ executeContentEditableInput()        │
│  ├── Is Draft.js editor? ───────▶ executeDraftJsInput()                │
│  ├── Is Select2 dropdown? ──────▶ executeSelect2Input()                │
│  ├── Is <select> element? ──────▶ executeSelectInput()                 │
│  └── Default ───────────────────▶ executeStandardInput()               │
│                                                                         │
│  action === 'enter'                                                     │
│  ├── Has value? ────────────────▶ executeInput() then dispatchEnter()  │
│  ├── Is <button>? ──────────────▶ dispatchEnter() + humanClick()       │
│  └── Default ───────────────────▶ dispatchEnter()                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Click Execution

### 3.1 Main Click Handler

```typescript
async function executeClick(
  element: HTMLElement,
  value?: string,
  bundle?: LocatorBundle
): Promise<boolean> {
  // Check for special element types
  
  // Radio/Checkbox groups
  const radioGroup = element.closest('[role="radiogroup"], [role="group"]');
  if (radioGroup || element.closest('[role="radio"], [role="checkbox"]')) {
    return executeRadioCheckboxClick(element, value, bundle);
  }
  
  // Select dropdowns
  if (element.tagName === 'SELECT') {
    return executeSelectChange(element as HTMLSelectElement, value);
  }
  
  // Google Autocomplete (closed shadow DOM)
  if (isGoogleAutocomplete(element, bundle)) {
    return delegateAutocompleteClick(bundle!, value);
  }
  
  // Standard click
  return humanClick(element);
}
```

### 3.2 Radio/Checkbox Click

```typescript
function executeRadioCheckboxClick(
  element: HTMLElement,
  value?: string,
  bundle?: LocatorBundle
): boolean {
  // Find the specific option to click
  const group = element.closest('[role="radiogroup"], [role="group"]') || element.parentElement;
  
  if (!group || !value) {
    // Click the element directly
    return humanClick(element);
  }
  
  // Find option by aria-label or text content
  const options = group.querySelectorAll('[role="radio"], [role="checkbox"], input[type="radio"], input[type="checkbox"]');
  
  for (const option of options) {
    const optionLabel = 
      option.getAttribute('aria-label') ||
      option.getAttribute('value') ||
      (option as HTMLElement).textContent?.trim() ||
      '';
    
    if (optionLabel.toLowerCase() === value.toLowerCase()) {
      return humanClick(option as HTMLElement);
    }
  }
  
  // Fallback: click first matching text
  const labels = group.querySelectorAll('label');
  for (const label of labels) {
    if (label.textContent?.toLowerCase().includes(value.toLowerCase())) {
      return humanClick(label as HTMLElement);
    }
  }
  
  // Last resort: click the original element
  return humanClick(element);
}
```

### 3.3 Select Dropdown Change

```typescript
function executeSelectChange(
  select: HTMLSelectElement,
  value?: string
): boolean {
  if (!value) {
    // Just focus the select
    select.focus();
    return true;
  }
  
  // Find matching option
  const options = Array.from(select.options);
  let targetOption: HTMLOptionElement | undefined;
  
  // Try exact value match
  targetOption = options.find(opt => opt.value === value);
  
  // Try text content match
  if (!targetOption) {
    targetOption = options.find(opt => 
      opt.textContent?.trim().toLowerCase() === value.toLowerCase()
    );
  }
  
  // Try partial text match
  if (!targetOption) {
    targetOption = options.find(opt =>
      opt.textContent?.toLowerCase().includes(value.toLowerCase())
    );
  }
  
  if (!targetOption) {
    console.warn(`Option not found in select: ${value}`);
    return false;
  }
  
  // Set the value
  select.value = targetOption.value;
  
  // Dispatch events
  select.dispatchEvent(new Event('input', { bubbles: true }));
  select.dispatchEvent(new Event('change', { bubbles: true }));
  
  return true;
}
```

---

## 4. Input Execution

### 4.1 Main Input Handler

```typescript
async function executeInput(
  element: HTMLElement,
  value: string,
  bundle?: LocatorBundle
): Promise<boolean> {
  // Focus the element first
  element.focus();
  
  // Route to appropriate handler
  
  // Contenteditable
  if (element.isContentEditable) {
    return executeContentEditableInput(element, value);
  }
  
  // Draft.js editor (X.com, Facebook)
  if (isDraftJsEditor(element)) {
    return executeDraftJsInput(element, value);
  }
  
  // Select2 custom dropdown
  if (isSelect2Element(element)) {
    return executeSelect2Input(element, value);
  }
  
  // Standard select
  if (element.tagName === 'SELECT') {
    return executeSelectChange(element as HTMLSelectElement, value);
  }
  
  // Google Autocomplete
  if (isGoogleAutocomplete(element, bundle)) {
    return delegateAutocompleteInput(bundle!, value);
  }
  
  // Standard input/textarea
  return executeStandardInput(element as HTMLInputElement, value);
}
```

### 4.2 Standard Input (React-Safe)

```typescript
function executeStandardInput(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string
): boolean {
  // Step 1: Focus
  element.focus();
  
  // Step 2: Clear existing value
  element.select(); // Select all text
  
  // Step 3: Get native value setter (bypasses React)
  const prototype = element instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  const nativeSetter = descriptor?.set;
  
  if (nativeSetter) {
    // Use native setter to bypass React's controlled input
    nativeSetter.call(element, value);
  } else {
    // Fallback for non-standard elements
    element.value = value;
  }
  
  // Step 4: Dispatch input event (triggers React onChange)
  element.dispatchEvent(new InputEvent('input', {
    bubbles: true,
    cancelable: true,
    inputType: 'insertText',
    data: value
  }));
  
  // Step 5: Dispatch change event (for onBlur handlers)
  element.dispatchEvent(new Event('change', {
    bubbles: true,
    cancelable: true
  }));
  
  return true;
}
```

### 4.3 Contenteditable Input

```typescript
function executeContentEditableInput(
  element: HTMLElement,
  value: string
): boolean {
  // Focus
  element.focus();
  
  // Clear existing content
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(element);
  selection?.removeAllRanges();
  selection?.addRange(range);
  
  // Set new content
  element.innerText = value;
  
  // Move cursor to end
  range.collapse(false);
  selection?.removeAllRanges();
  selection?.addRange(range);
  
  // Dispatch events
  element.dispatchEvent(new InputEvent('input', {
    bubbles: true,
    inputType: 'insertText',
    data: value
  }));
  
  return true;
}
```

### 4.4 Draft.js Input (X.com/Twitter)

```typescript
function isDraftJsEditor(element: HTMLElement): boolean {
  // Draft.js editors have specific structure
  return (
    element.isContentEditable &&
    (element.id?.includes('placeholder') ||
     element.className?.includes('DraftEditor') ||
     element.closest('[data-testid="tweetTextarea"]') !== null)
  );
}

function executeDraftJsInput(
  element: HTMLElement,
  value: string
): boolean {
  // Focus the editor
  element.focus();
  
  // Draft.js requires execCommand for proper state management
  const success = document.execCommand('insertText', false, value);
  
  if (!success) {
    // Fallback to direct manipulation
    element.innerText = value;
    element.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      inputType: 'insertText',
      data: value
    }));
  }
  
  return true;
}
```

### 4.5 Select2 Input

```typescript
function isSelect2Element(element: HTMLElement): boolean {
  return (
    element.classList.contains('select2-hidden-accessible') ||
    element.classList.contains('select2-selection') ||
    element.closest('.select2-container') !== null
  );
}

function executeSelect2Input(
  element: HTMLElement,
  value: string
): boolean {
  // Find the original <select> element
  const originalSelect = getOriginalSelect(element);
  
  if (!originalSelect) {
    console.warn('Could not find original select for Select2');
    return false;
  }
  
  // Find matching option
  const options = Array.from(originalSelect.options);
  const targetOption = options.find(opt =>
    opt.value === value ||
    opt.textContent?.toLowerCase().includes(value.toLowerCase())
  );
  
  if (!targetOption) {
    console.warn(`Select2 option not found: ${value}`);
    return false;
  }
  
  // Set value on original select
  originalSelect.value = targetOption.value;
  
  // Trigger Select2's change detection
  const changeEvent = new Event('change', { bubbles: true });
  originalSelect.dispatchEvent(changeEvent);
  
  // Also trigger on the Select2 container
  const container = element.closest('.select2-container');
  if (container) {
    container.dispatchEvent(new Event('select2:select', { bubbles: true }));
  }
  
  return true;
}

function getOriginalSelect(element: HTMLElement): HTMLSelectElement | null {
  // Select2 hides the original select with class 'select2-hidden-accessible'
  const container = element.closest('.select2-container');
  
  if (container) {
    // Original select is usually previous sibling
    const prevSibling = container.previousElementSibling;
    if (prevSibling?.tagName === 'SELECT') {
      return prevSibling as HTMLSelectElement;
    }
  }
  
  // Try finding by ID pattern
  const id = element.id || '';
  const selectId = id.replace('select2-', '').replace('-container', '').replace('-results', '');
  
  if (selectId) {
    return document.getElementById(selectId) as HTMLSelectElement;
  }
  
  return null;
}
```

---

## 5. Enter/Submit Execution

### 5.1 Enter Key Handler

```typescript
async function executeEnter(
  element: HTMLElement,
  value?: string,
  bundle?: LocatorBundle
): Promise<boolean> {
  // Optionally set value first
  if (value !== undefined && value !== '') {
    await executeInput(element, value, bundle);
    
    // Wait for React to process value change
    await sleep(50);
  }
  
  // Dispatch keyboard events
  dispatchEnterKey(element);
  
  // If button, also trigger click
  if (element.tagName === 'BUTTON' || element.getAttribute('role') === 'button') {
    await sleep(10);
    humanClick(element);
  }
  
  return true;
}
```

### 5.2 Enter Key Event Sequence

```typescript
function dispatchEnterKey(element: HTMLElement): void {
  const keyboardEventInit: KeyboardEventInit = {
    bubbles: true,
    cancelable: true,
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    charCode: 13
  };
  
  // Full keyboard event sequence
  element.dispatchEvent(new KeyboardEvent('keydown', keyboardEventInit));
  element.dispatchEvent(new KeyboardEvent('keypress', keyboardEventInit));
  element.dispatchEvent(new KeyboardEvent('keyup', keyboardEventInit));
}
```

---

## 6. Human-Like Event Sequences

### 6.1 Click Event Sequence

```typescript
function humanClick(element: HTMLElement): boolean {
  // Calculate center point of element
  const rect = element.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  
  const mouseEventInit: MouseEventInit = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: x,
    clientY: y,
    screenX: x + window.screenX,
    screenY: y + window.screenY,
    button: 0,
    buttons: 1
  };
  
  // Dispatch events in realistic order
  element.dispatchEvent(new MouseEvent('mouseover', mouseEventInit));
  element.dispatchEvent(new MouseEvent('mouseenter', { ...mouseEventInit, bubbles: false }));
  element.dispatchEvent(new MouseEvent('mousemove', mouseEventInit));
  element.dispatchEvent(new MouseEvent('mousedown', mouseEventInit));
  
  // Focus happens between mousedown and mouseup
  element.focus();
  
  element.dispatchEvent(new MouseEvent('mouseup', mouseEventInit));
  element.dispatchEvent(new MouseEvent('click', mouseEventInit));
  
  return true;
}
```

### 6.2 Why Human-Like Events Matter

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    EVENT SEQUENCE IMPORTANCE                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  FRAMEWORK EVENT HANDLERS                                               │
│  ├── React: onMouseEnter, onMouseDown, onClick handlers                │
│  ├── Vue: @mouseenter, @mousedown, @click directives                   │
│  ├── Angular: (mouseenter), (mousedown), (click) bindings              │
│  └── jQuery: .on('mouseenter'), .on('mousedown'), .on('click')         │
│                                                                         │
│  DROPDOWN MENUS                                                         │
│  ├── Open on mouseover/mouseenter                                       │
│  ├── May close on mouseout before click                                 │
│  └── Require proper event order                                         │
│                                                                         │
│  DRAG AND DROP                                                          │
│  ├── Initialize on mousedown                                            │
│  ├── Track on mousemove                                                 │
│  └── Complete on mouseup                                                │
│                                                                         │
│  BOT DETECTION                                                          │
│  ├── Some sites check for realistic event patterns                      │
│  ├── Missing mousemove may trigger bot flags                            │
│  └── Proper event order mimics real user                                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.3 Focus Event Sequence

```typescript
function focusElement(element: HTMLElement): void {
  // Proper focus sequence
  const previousActive = document.activeElement as HTMLElement;
  
  // Blur previous element
  if (previousActive && previousActive !== element) {
    previousActive.dispatchEvent(new FocusEvent('blur', {
      bubbles: false,
      relatedTarget: element
    }));
    previousActive.dispatchEvent(new FocusEvent('focusout', {
      bubbles: true,
      relatedTarget: element
    }));
  }
  
  // Focus new element
  element.focus();
  
  element.dispatchEvent(new FocusEvent('focus', {
    bubbles: false,
    relatedTarget: previousActive
  }));
  element.dispatchEvent(new FocusEvent('focusin', {
    bubbles: true,
    relatedTarget: previousActive
  }));
}
```

---

## 7. Framework-Specific Handlers

### 7.1 React Controlled Inputs

```typescript
/**
 * React's controlled inputs maintain state internally.
 * Direct value assignment doesn't trigger re-render.
 * Must use native setter + synthetic events.
 */
function setReactInputValue(
  input: HTMLInputElement,
  value: string
): void {
  // Get the native setter from prototype chain
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value'
  )?.set;
  
  const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    'value'
  )?.set;
  
  const setter = input instanceof HTMLTextAreaElement
    ? nativeTextAreaValueSetter
    : nativeInputValueSetter;
  
  if (setter) {
    setter.call(input, value);
  } else {
    input.value = value;
  }
  
  // Create event that React's event system recognizes
  const inputEvent = new InputEvent('input', {
    bubbles: true,
    cancelable: true,
    inputType: 'insertText',
    data: value
  });
  
  // React 17+ uses inputType
  Object.defineProperty(inputEvent, 'target', {
    writable: false,
    value: input
  });
  
  input.dispatchEvent(inputEvent);
}
```

### 7.2 Vue v-model

```typescript
/**
 * Vue's v-model works with standard input events.
 * Native setter approach also works for Vue.
 */
function setVueInputValue(
  input: HTMLInputElement,
  value: string
): void {
  // Focus first
  input.focus();
  
  // Set value using native setter
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value'
  )?.set;
  
  if (setter) {
    setter.call(input, value);
  }
  
  // Vue listens to input event for v-model
  input.dispatchEvent(new Event('input', { bubbles: true }));
  
  // Also dispatch change for v-model.lazy
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
```

### 7.3 Angular ngModel

```typescript
/**
 * Angular's ngModel also uses standard events.
 * Same approach works across frameworks.
 */
function setAngularInputValue(
  input: HTMLInputElement,
  value: string
): void {
  input.focus();
  
  // Angular uses zone.js for change detection
  // Native setter triggers the necessary updates
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value'
  )?.set;
  
  if (setter) {
    setter.call(input, value);
  }
  
  // Dispatch events
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  
  // Angular may need blur for validation
  input.dispatchEvent(new Event('blur', { bubbles: true }));
}
```

---

## 8. Visibility Management

### 8.1 Temporary Show Function

```typescript
interface HiddenElement {
  element: HTMLElement;
  originalDisplay: string;
}

function temporarilyShow(element: HTMLElement): () => void {
  const hiddenElements: HiddenElement[] = [];
  
  // Walk up the DOM tree
  let current: HTMLElement | null = element;
  
  while (current && current !== document.body) {
    const style = getComputedStyle(current);
    
    if (style.display === 'none') {
      hiddenElements.push({
        element: current,
        originalDisplay: current.style.display
      });
      
      // Show the element
      current.style.display = 'block';
    }
    
    current = current.parentElement;
  }
  
  // Return restore function
  return () => {
    for (const { element, originalDisplay } of hiddenElements) {
      element.style.display = originalDisplay;
    }
  };
}
```

### 8.2 Scroll Into View

```typescript
function ensureElementVisible(element: HTMLElement): void {
  // Check if element is in viewport
  const rect = element.getBoundingClientRect();
  const inViewport = (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= window.innerHeight &&
    rect.right <= window.innerWidth
  );
  
  if (!inViewport) {
    // Scroll element into view
    element.scrollIntoView({
      behavior: 'instant',
      block: 'center',
      inline: 'center'
    });
  }
}
```

---

## 9. Value Injection Patterns

### 9.1 Input Types Matrix

| Input Type | Injection Method | Events Required |
|------------|------------------|-----------------|
| text | Native setter | input, change |
| password | Native setter | input, change |
| email | Native setter | input, change |
| number | Native setter + validation | input, change |
| tel | Native setter | input, change |
| url | Native setter | input, change |
| search | Native setter | input, change, search |
| date | Direct value | input, change |
| time | Direct value | input, change |
| datetime-local | Direct value | input, change |
| checkbox | click | change |
| radio | click | change |
| file | DataTransfer | change |
| range | Direct value | input, change |
| color | Direct value | input, change |

### 9.2 File Input Handling

```typescript
async function setFileInputValue(
  input: HTMLInputElement,
  filePath: string
): Promise<boolean> {
  // Note: Cannot set file input value directly for security
  // Would need to use DataTransfer API with actual File objects
  
  // This is a limitation - file uploads require actual files
  console.warn('File input automation requires DataTransfer with File objects');
  
  // In VDI context, this would be handled differently:
  // const file = await fetchFile(filePath);
  // const dataTransfer = new DataTransfer();
  // dataTransfer.items.add(file);
  // input.files = dataTransfer.files;
  
  return false;
}
```

### 9.3 Checkbox/Radio Toggle

```typescript
function toggleCheckboxRadio(
  input: HTMLInputElement,
  shouldBeChecked?: boolean
): boolean {
  const currentState = input.checked;
  const targetState = shouldBeChecked ?? !currentState;
  
  if (currentState === targetState) {
    return true; // Already in desired state
  }
  
  // Click to toggle
  humanClick(input);
  
  // Verify state changed
  if (input.checked !== targetState) {
    // Force the change
    input.checked = targetState;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  
  return true;
}
```

---

## 10. Event Dispatching

### 10.1 Event Factory Functions

```typescript
function createMouseEvent(
  type: string,
  element: HTMLElement,
  options: Partial<MouseEventInit> = {}
): MouseEvent {
  const rect = element.getBoundingClientRect();
  
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
    button: 0,
    buttons: type === 'mousedown' ? 1 : 0,
    ...options
  });
}

function createKeyboardEvent(
  type: string,
  key: string,
  options: Partial<KeyboardEventInit> = {}
): KeyboardEvent {
  const keyCode = key === 'Enter' ? 13 : key === 'Tab' ? 9 : key.charCodeAt(0);
  
  return new KeyboardEvent(type, {
    bubbles: true,
    cancelable: true,
    key: key,
    code: key === 'Enter' ? 'Enter' : `Key${key.toUpperCase()}`,
    keyCode: keyCode,
    which: keyCode,
    ...options
  });
}

function createInputEvent(
  value: string,
  options: Partial<InputEventInit> = {}
): InputEvent {
  return new InputEvent('input', {
    bubbles: true,
    cancelable: true,
    inputType: 'insertText',
    data: value,
    ...options
  });
}
```

### 10.2 Event Dispatch Order

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    COMPLETE CLICK SEQUENCE                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. pointerover    (PointerEvent, bubbles)                             │
│  2. pointerenter   (PointerEvent, no bubble)                           │
│  3. mouseover      (MouseEvent, bubbles)                               │
│  4. mouseenter     (MouseEvent, no bubble)                             │
│  5. pointermove    (PointerEvent, bubbles)                             │
│  6. mousemove      (MouseEvent, bubbles)                               │
│  7. pointerdown    (PointerEvent, bubbles)                             │
│  8. mousedown      (MouseEvent, bubbles)                               │
│  9. focus          (FocusEvent, no bubble)                             │
│  10. focusin       (FocusEvent, bubbles)                               │
│  11. pointerup     (PointerEvent, bubbles)                             │
│  12. mouseup       (MouseEvent, bubbles)                               │
│  13. click         (MouseEvent, bubbles)                               │
│                                                                         │
│  SIMPLIFIED VERSION (usually sufficient):                              │
│  mouseover → mouseenter → mousemove → mousedown →                      │
│  focus → mouseup → click                                               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 11. Error Handling

### 11.1 Graceful Failure Pattern

```typescript
async function executeActionSafe(
  element: HTMLElement,
  action: ActionType,
  value?: string
): Promise<ActionResult> {
  const startTime = performance.now();
  
  try {
    let success = false;
    
    switch (action) {
      case 'click':
        success = humanClick(element);
        break;
      case 'input':
        success = executeStandardInput(element as HTMLInputElement, value!);
        break;
      case 'enter':
        success = await executeEnter(element, value);
        break;
    }
    
    return {
      success,
      duration: performance.now() - startTime,
      action,
      element: describeElement(element)
    };
  } catch (error) {
    return {
      success: false,
      duration: performance.now() - startTime,
      action,
      error: error instanceof Error ? error.message : String(error),
      element: describeElement(element)
    };
  }
}

interface ActionResult {
  success: boolean;
  duration: number;
  action: ActionType;
  element?: string;
  error?: string;
}

function describeElement(element: HTMLElement): string {
  return `<${element.tagName.toLowerCase()} id="${element.id}" class="${element.className}">`;
}
```

### 11.2 Retry Logic

```typescript
async function executeWithRetry(
  element: HTMLElement,
  action: ActionType,
  value?: string,
  maxRetries: number = 2
): Promise<boolean> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await executeActionSafe(element, action, value);
    
    if (result.success) {
      return true;
    }
    
    if (attempt < maxRetries) {
      console.warn(`Action failed, retrying (${attempt + 1}/${maxRetries})`);
      await sleep(100 * (attempt + 1)); // Increasing delay
    }
  }
  
  return false;
}
```

---

## 12. Timing and Delays

### 12.1 Delay Constants

```typescript
const ACTION_TIMING = {
  // Post-action delays
  afterInput: 0,           // No delay after standard input
  afterReactInput: 50,     // Wait for React state update
  afterClick: 0,           // No delay after click
  afterEnter: 0,           // No delay after Enter
  
  // Pre-action delays
  beforeAction: 0,         // No pre-delay
  
  // Between events
  betweenMouseEvents: 0,   // No delay between mouse events
  betweenKeyEvents: 0,     // No delay between key events
  
  // Retry delays
  retryDelay: 100,         // Initial retry delay
  retryBackoff: 2          // Multiplier for subsequent retries
};
```

### 12.2 Configurable Timing

```typescript
interface ActionOptions {
  preDelay?: number;
  postDelay?: number;
  humanLike?: boolean;     // Add random micro-delays
}

async function executeWithTiming(
  action: () => boolean,
  options: ActionOptions = {}
): Promise<boolean> {
  const { preDelay = 0, postDelay = 0, humanLike = false } = options;
  
  // Pre-delay
  if (preDelay > 0) {
    await sleep(preDelay + (humanLike ? randomDelay() : 0));
  }
  
  // Execute action
  const result = action();
  
  // Post-delay
  if (postDelay > 0) {
    await sleep(postDelay + (humanLike ? randomDelay() : 0));
  }
  
  return result;
}

function randomDelay(): number {
  return Math.floor(Math.random() * 50); // 0-50ms random
}
```

---

## 13. Special Cases

### 13.1 Google Autocomplete Delegation

```typescript
function isGoogleAutocomplete(
  element: HTMLElement,
  bundle?: LocatorBundle
): boolean {
  // Check for Google Maps Place Autocomplete
  const isGmpAutocomplete = 
    element.tagName.toLowerCase() === 'gmp-place-autocomplete' ||
    element.closest('gmp-place-autocomplete') !== null;
  
  // Check bundle shadow host indicators
  const hasShadowHost = bundle?.shadowHosts?.some(host =>
    host.includes('gmp-place-autocomplete')
  );
  
  return isGmpAutocomplete || !!hasShadowHost;
}

function delegateAutocompleteInput(
  bundle: LocatorBundle,
  value: string
): boolean {
  window.postMessage({
    type: 'REPLAY_AUTOCOMPLETE',
    action: 'AUTOCOMPLETE_INPUT',
    bundle: bundle,
    value: value
  }, '*');
  
  return true; // Assume success, page script handles actual execution
}

function delegateAutocompleteClick(
  bundle: LocatorBundle,
  value?: string
): boolean {
  window.postMessage({
    type: 'REPLAY_AUTOCOMPLETE',
    action: 'AUTOCOMPLETE_SELECTION',
    bundle: bundle,
    value: value
  }, '*');
  
  return true;
}
```

### 13.2 Double-Click Handler

```typescript
function humanDoubleClick(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  
  const mouseEventInit: MouseEventInit = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: x,
    clientY: y,
    button: 0,
    buttons: 1,
    detail: 2 // Double-click
  };
  
  // First click
  element.dispatchEvent(new MouseEvent('mousedown', { ...mouseEventInit, detail: 1 }));
  element.dispatchEvent(new MouseEvent('mouseup', { ...mouseEventInit, detail: 1 }));
  element.dispatchEvent(new MouseEvent('click', { ...mouseEventInit, detail: 1 }));
  
  // Second click
  element.dispatchEvent(new MouseEvent('mousedown', mouseEventInit));
  element.dispatchEvent(new MouseEvent('mouseup', mouseEventInit));
  element.dispatchEvent(new MouseEvent('click', mouseEventInit));
  
  // Double-click event
  element.dispatchEvent(new MouseEvent('dblclick', mouseEventInit));
  
  return true;
}
```

### 13.3 Right-Click Handler

```typescript
function humanRightClick(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  
  const mouseEventInit: MouseEventInit = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: x,
    clientY: y,
    button: 2,      // Right button
    buttons: 2
  };
  
  element.dispatchEvent(new MouseEvent('mousedown', mouseEventInit));
  element.dispatchEvent(new MouseEvent('mouseup', mouseEventInit));
  element.dispatchEvent(new MouseEvent('contextmenu', mouseEventInit));
  
  return true;
}
```

---

## Summary

The Action Execution System provides:

✅ Three core action types: click, input, enter  
✅ Human-like event sequences preventing bot detection  
✅ React-safe input handling via native property descriptors  
✅ Framework-agnostic approach working with React, Vue, Angular  
✅ Special case handlers for Select2, Draft.js, Google Autocomplete  
✅ Visibility management for hidden element interaction  
✅ Comprehensive event dispatching with correct order  
✅ Graceful error handling without throwing exceptions  
✅ Configurable timing for different execution modes

This system ensures reliable action execution across modern web frameworks and custom UI components.
