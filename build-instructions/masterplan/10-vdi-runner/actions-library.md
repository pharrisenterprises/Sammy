# Actions Library
**Project:** Chrome Extension Test Recorder - VDI Runner  
**Document Version:** 1.0  
**Last Updated:** November 25, 2025  
**Status:** Complete Technical Specification

## Table of Contents
1. Overview
2. Action Registry
3. Click Actions
4. Input Actions
5. Select Actions
6. Navigation Actions
7. Keyboard Actions
8. Framework-Specific Handling
9. Wait Strategies
10. Testing Strategy

---

## 1. Overview

### 1.1 Purpose

The Actions Library provides a comprehensive set of action handlers for executing recorded user interactions in Playwright, including clicks, text input, dropdown selection, navigation, and keyboard events.

### 1.2 Supported Actions

| Action | Description | Event Type |
|--------|-------------|------------|
| **Click** | Mouse click on element | click |
| **Input** | Text input into field | input |
| **Select** | Dropdown option selection | select |
| **Navigate** | Page navigation | navigate |
| **Keypress** | Keyboard event | keypress |
| **Hover** | Mouse hover (Phase 2) | hover |
| **Drag** | Drag and drop (Phase 2) | drag |
| **Upload** | File upload (Phase 2) | upload |

### 1.3 Design Principles
```
1. HUMAN-LIKE BEHAVIOR
   - Realistic event sequences
   - Natural timing delays
   - Framework-aware interactions

2. FRAMEWORK COMPATIBILITY
   - React controlled inputs
   - Vue reactivity
   - Angular change detection
   - Select2/Chosen dropdowns

3. ERROR RESILIENCE
   - Retry on transient failures
   - Graceful degradation
   - Detailed error reporting

4. EXTENSIBILITY
   - Action handler interface
   - Plugin architecture
   - Custom action support
```

---

## 2. Action Registry

### 2.1 Handler Interface
```typescript
// src/actions/action-handler.ts
import { Page, Locator } from 'playwright';

export interface ActionHandler {
  name: string;
  canHandle(step: RecordedStep): boolean;
  execute(page: Page, element: Locator, step: RecordedStep): Promise<void>;
}

export interface RecordedStep {
  event: string;
  bundle: LocatorBundle;
  value?: string;
  label?: string;
  navigation?: {
    type: 'none' | 'navigate' | 'new_tab' | 'close_tab';
    url?: string;
  };
  key?: string;
  options?: Record<string, any>;
}
```

### 2.2 Action Registry
```typescript
// src/actions/action-registry.ts
export class ActionRegistry {
  private handlers: Map<string, ActionHandler> = new Map();

  constructor() {
    this.registerDefaultHandlers();
  }

  private registerDefaultHandlers(): void {
    this.register(new ClickAction());
    this.register(new InputAction());
    this.register(new SelectAction());
    this.register(new NavigateAction());
    this.register(new KeypressAction());
  }

  register(handler: ActionHandler): void {
    this.handlers.set(handler.name, handler);
    console.log(`✅ Registered action handler: ${handler.name}`);
  }

  getHandler(eventType: string): ActionHandler | undefined {
    return this.handlers.get(eventType);
  }

  async execute(
    page: Page,
    element: Locator,
    step: RecordedStep
  ): Promise<void> {
    const handler = this.getHandler(step.event);

    if (!handler) {
      throw new Error(`No handler for action type: ${step.event}`);
    }

    await handler.execute(page, element, step);
  }
}
```

---

## 3. Click Actions

### 3.1 Click Handler
```typescript
// src/actions/click-action.ts
export class ClickAction implements ActionHandler {
  name = 'click';

  canHandle(step: RecordedStep): boolean {
    return step.event === 'click';
  }

  async execute(page: Page, element: Locator, step: RecordedStep): Promise<void> {
    // Wait for element to be visible
    await element.waitFor({ state: 'visible', timeout: 10000 });

    // Determine click type
    const clickType = this.determineClickType(step);

    switch (clickType) {
      case 'standard':
        await this.standardClick(element);
        break;

      case 'checkbox':
        await this.checkboxClick(element, step);
        break;

      case 'radio':
        await this.radioClick(element, step);
        break;

      case 'button':
        await this.buttonClick(element);
        break;

      default:
        await this.standardClick(element);
    }

    // Wait for navigation if expected
    if (step.navigation?.type === 'navigate') {
      await page.waitForLoadState('domcontentloaded', { timeout: 30000 });
    }
  }

  private determineClickType(step: RecordedStep): string {
    const tag = step.bundle.tag?.toLowerCase();
    const type = step.bundle.dataAttrs?.type?.toLowerCase();

    if (type === 'checkbox') return 'checkbox';
    if (type === 'radio') return 'radio';
    if (tag === 'button' || type === 'submit') return 'button';

    return 'standard';
  }

  private async standardClick(element: Locator): Promise<void> {
    await element.click({ timeout: 5000 });
  }

  private async checkboxClick(element: Locator, step: RecordedStep): Promise<void> {
    const isChecked = await element.isChecked();
    const shouldBeChecked = step.value === 'true' || step.value === '1';

    if (isChecked !== shouldBeChecked) {
      await element.click();
    }
  }

  private async radioClick(element: Locator, step: RecordedStep): Promise<void> {
    // Find radio by value
    if (step.value) {
      const radioGroup = element.locator(`[value="${step.value}"]`);
      await radioGroup.click();
    } else {
      await element.click();
    }
  }

  private async buttonClick(element: Locator): Promise<void> {
    // Ensure button is enabled
    await element.waitFor({ state: 'attached' });

    const isDisabled = await element.isDisabled();
    if (isDisabled) {
      throw new Error('Button is disabled');
    }

    await element.click();
  }
}
```

### 3.2 Human-Like Click Sequence
```typescript
async humanLikeClick(page: Page, element: Locator): Promise<void> {
  // Get element bounding box
  const box = await element.boundingBox();

  if (!box) {
    throw new Error('Element has no bounding box');
  }

  // Calculate center point
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  // Dispatch mouse events in sequence
  await page.mouse.move(x, y);
  await page.waitForTimeout(50);  // Brief pause

  await page.mouse.down();
  await page.waitForTimeout(30);  // Click duration

  await page.mouse.up();
}
```

---

## 4. Input Actions

### 4.1 Input Handler
```typescript
// src/actions/input-action.ts
export class InputAction implements ActionHandler {
  name = 'input';

  canHandle(step: RecordedStep): boolean {
    return step.event === 'input';
  }

  async execute(page: Page, element: Locator, step: RecordedStep): Promise<void> {
    const value = step.value || '';

    // Wait for element to be visible and editable
    await element.waitFor({ state: 'visible', timeout: 10000 });

    // Determine input type
    const inputType = await this.determineInputType(element, step);

    switch (inputType) {
      case 'standard':
        await this.standardInput(element, value);
        break;

      case 'contenteditable':
        await this.contenteditableInput(page, element, value);
        break;

      case 'react':
        await this.reactSafeInput(page, element, value);
        break;

      case 'select2':
        await this.select2Input(page, element, value);
        break;

      default:
        await this.standardInput(element, value);
    }
  }

  private async determineInputType(
    element: Locator,
    step: RecordedStep
  ): Promise<string> {
    const tag = step.bundle.tag?.toLowerCase();

    // Check for contenteditable
    const isContentEditable = await element.evaluate(
      (el) => el.getAttribute('contenteditable') === 'true'
    );

    if (isContentEditable) return 'contenteditable';

    // Check for Select2
    const isSelect2 = await element.evaluate(
      (el) => el.classList.contains('select2-selection__rendered')
    );

    if (isSelect2) return 'select2';

    // Check for React controlled input
    const hasReactFiber = await element.evaluate(
      (el) => Object.keys(el).some(key => key.startsWith('__reactFiber'))
    );

    if (hasReactFiber) return 'react';

    return 'standard';
  }

  private async standardInput(element: Locator, value: string): Promise<void> {
    // Clear existing value
    await element.clear();

    // Type new value
    await element.fill(value);

    // Brief wait for any handlers
    await element.page().waitForTimeout(100);
  }

  private async contenteditableInput(
    page: Page,
    element: Locator,
    value: string
  ): Promise<void> {
    // Focus element
    await element.focus();

    // Clear content
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Delete');

    // Type new content
    await element.type(value);
  }

  private async reactSafeInput(
    page: Page,
    element: Locator,
    value: string
  ): Promise<void> {
    // Focus element
    await element.focus();

    // Clear using keyboard
    await page.keyboard.press('Control+A');

    // Use fill() which properly triggers React's onChange
    await element.fill(value);

    // Dispatch additional events for React
    await element.dispatchEvent('input', { bubbles: true });
    await element.dispatchEvent('change', { bubbles: true });

    // Brief wait for React state update
    await page.waitForTimeout(100);
  }

  private async select2Input(
    page: Page,
    element: Locator,
    value: string
  ): Promise<void> {
    // Click to open Select2 dropdown
    await element.click();

    // Wait for dropdown
    await page.waitForSelector('.select2-results', { timeout: 5000 });

    // Type search value
    await page.keyboard.type(value);

    // Wait for results
    await page.waitForTimeout(300);

    // Click first matching result
    const option = page.locator('.select2-results__option--highlighted');
    await option.click();
  }
}
```

### 4.2 Draft.js Input (Twitter/X)
```typescript
async draftJsInput(page: Page, element: Locator, value: string): Promise<void> {
  // Focus the editor
  await element.focus();

  // Use execCommand for Draft.js compatibility
  await page.evaluate((text) => {
    document.execCommand('insertText', false, text);
  }, value);
}
```

---

## 5. Select Actions

### 5.1 Select Handler
```typescript
// src/actions/select-action.ts
export class SelectAction implements ActionHandler {
  name = 'select';

  canHandle(step: RecordedStep): boolean {
    return step.event === 'select';
  }

  async execute(page: Page, element: Locator, step: RecordedStep): Promise<void> {
    const value = step.value || '';

    // Wait for element
    await element.waitFor({ state: 'visible', timeout: 10000 });

    // Determine select type
    const selectType = await this.determineSelectType(element);

    switch (selectType) {
      case 'native':
        await this.nativeSelect(element, value);
        break;

      case 'select2':
        await this.select2Select(page, element, value);
        break;

      case 'custom':
        await this.customSelect(page, element, value);
        break;

      default:
        await this.nativeSelect(element, value);
    }
  }

  private async determineSelectType(element: Locator): Promise<string> {
    const tag = await element.evaluate((el) => el.tagName.toLowerCase());

    if (tag === 'select') return 'native';

    const isSelect2 = await element.evaluate(
      (el) => el.classList.contains('select2')
    );

    if (isSelect2) return 'select2';

    return 'custom';
  }

  private async nativeSelect(element: Locator, value: string): Promise<void> {
    await element.selectOption(value);
  }

  private async select2Select(
    page: Page,
    element: Locator,
    value: string
  ): Promise<void> {
    // Click to open
    await element.click();

    // Wait for dropdown
    await page.waitForSelector('.select2-dropdown', { timeout: 5000 });

    // Find and click option
    const option = page.locator(`.select2-results__option:has-text("${value}")`);
    await option.click();
  }

  private async customSelect(
    page: Page,
    element: Locator,
    value: string
  ): Promise<void> {
    // Click to open dropdown
    await element.click();

    // Wait for options to appear
    await page.waitForTimeout(300);

    // Look for option with matching text
    const option = page.locator(`[role="option"]:has-text("${value}")`);

    if (await option.count() > 0) {
      await option.first().click();
    } else {
      // Try li elements
      const li = page.locator(`li:has-text("${value}")`);
      await li.first().click();
    }
  }
}
```

---

## 6. Navigation Actions

### 6.1 Navigate Handler
```typescript
// src/actions/navigate-action.ts
export class NavigateAction implements ActionHandler {
  name = 'navigate';

  canHandle(step: RecordedStep): boolean {
    return step.event === 'navigate' || step.event === 'open';
  }

  async execute(page: Page, element: Locator, step: RecordedStep): Promise<void> {
    const navigationType = step.navigation?.type || 'navigate';
    const url = step.navigation?.url || step.value;

    switch (navigationType) {
      case 'navigate':
        await this.navigateTo(page, url!);
        break;

      case 'reload':
        await this.reload(page);
        break;

      case 'back':
        await this.goBack(page);
        break;

      case 'forward':
        await this.goForward(page);
        break;

      default:
        await this.navigateTo(page, url!);
    }
  }

  private async navigateTo(page: Page, url: string): Promise<void> {
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Additional wait for dynamic content
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
      // Network idle timeout is not critical
      console.warn('Network idle timeout, continuing...');
    });
  }

  private async reload(page: Page): Promise<void> {
    await page.reload({
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
  }

  private async goBack(page: Page): Promise<void> {
    await page.goBack({
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
  }

  private async goForward(page: Page): Promise<void> {
    await page.goForward({
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
  }
}
```

---

## 7. Keyboard Actions

### 7.1 Keypress Handler
```typescript
// src/actions/keypress-action.ts
export class KeypressAction implements ActionHandler {
  name = 'keypress';

  canHandle(step: RecordedStep): boolean {
    return step.event === 'keypress' || step.event === 'enter';
  }

  async execute(page: Page, element: Locator, step: RecordedStep): Promise<void> {
    const key = step.key || 'Enter';

    // Focus element first if provided
    if (element) {
      await element.focus();
    }

    // Map common key names
    const mappedKey = this.mapKeyName(key);

    // Press key
    await page.keyboard.press(mappedKey);

    // Wait for any triggered actions
    await page.waitForTimeout(100);
  }

  private mapKeyName(key: string): string {
    const keyMap: Record<string, string> = {
      'enter': 'Enter',
      'tab': 'Tab',
      'escape': 'Escape',
      'esc': 'Escape',
      'space': 'Space',
      'backspace': 'Backspace',
      'delete': 'Delete',
      'arrowup': 'ArrowUp',
      'arrowdown': 'ArrowDown',
      'arrowleft': 'ArrowLeft',
      'arrowright': 'ArrowRight'
    };

    return keyMap[key.toLowerCase()] || key;
  }
}
```

### 7.2 Key Combinations
```typescript
async pressKeyCombination(page: Page, keys: string[]): Promise<void> {
  // Press modifier keys
  for (const key of keys.slice(0, -1)) {
    await page.keyboard.down(key);
  }

  // Press final key
  await page.keyboard.press(keys[keys.length - 1]);

  // Release modifier keys in reverse order
  for (const key of keys.slice(0, -1).reverse()) {
    await page.keyboard.up(key);
  }
}

// Usage examples:
// await pressKeyCombination(page, ['Control', 'a']);  // Select all
// await pressKeyCombination(page, ['Control', 'c']);  // Copy
// await pressKeyCombination(page, ['Control', 'v']);  // Paste
// await pressKeyCombination(page, ['Control', 'Shift', 'Enter']); // Submit with modifier
```

---

## 8. Framework-Specific Handling

### 8.1 React Adapter
```typescript
export class ReactInputAdapter {
  async setInputValue(page: Page, element: Locator, value: string): Promise<void> {
    // Use Playwright's fill() which properly handles React
    await element.focus();
    await element.fill(value);

    // Dispatch events that React listens to
    await element.evaluate((el, val) => {
      // Get React's internal setter
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set;

      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(el, val);
      }

      // Dispatch React-compatible events
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
  }
}
```

### 8.2 Vue Adapter
```typescript
export class VueInputAdapter {
  async setInputValue(page: Page, element: Locator, value: string): Promise<void> {
    await element.focus();
    await element.fill(value);

    // Vue uses input event for v-model
    await element.dispatchEvent('input', { bubbles: true });

    // Brief wait for Vue reactivity
    await page.waitForTimeout(50);
  }
}
```

### 8.3 Angular Adapter
```typescript
export class AngularInputAdapter {
  async setInputValue(page: Page, element: Locator, value: string): Promise<void> {
    await element.focus();
    await element.fill(value);

    // Angular uses input and blur for change detection
    await element.dispatchEvent('input', { bubbles: true });
    await element.blur();

    // Wait for Angular's change detection cycle
    await page.waitForTimeout(100);
  }
}
```

---

## 9. Wait Strategies

### 9.1 Smart Wait
```typescript
export class SmartWait {
  async waitForElement(page: Page, locator: Locator): Promise<void> {
    // Wait for element to be attached
    await locator.waitFor({ state: 'attached', timeout: 10000 });

    // Wait for element to be visible
    await locator.waitFor({ state: 'visible', timeout: 5000 });

    // Wait for element to be stable (not moving)
    await this.waitForStability(locator);
  }

  private async waitForStability(locator: Locator, maxChecks: number = 3): Promise<void> {
    let lastBox: { x: number; y: number } | null = null;
    let stableCount = 0;

    while (stableCount < maxChecks) {
      const box = await locator.boundingBox();

      if (box && lastBox && box.x === lastBox.x && box.y === lastBox.y) {
        stableCount++;
      } else {
        stableCount = 0;
      }

      lastBox = box ? { x: box.x, y: box.y } : null;
      await locator.page().waitForTimeout(50);
    }
  }

  async waitForNetworkIdle(page: Page, timeout: number = 5000): Promise<void> {
    try {
      await page.waitForLoadState('networkidle', { timeout });
    } catch (error) {
      // Network idle is best-effort
      console.warn('Network idle timeout, continuing...');
    }
  }

  async waitForAnimations(page: Page): Promise<void> {
    await page.evaluate(() => {
      return new Promise((resolve) => {
        const animations = document.getAnimations();

        if (animations.length === 0) {
          resolve();
          return;
        }

        Promise.all(animations.map(a => a.finished))
          .then(() => resolve())
          .catch(() => resolve());
      });
    });
  }
}
```

---

## 10. Testing Strategy

### 10.1 Unit Tests
```typescript
describe('ClickAction', () => {
  it('clicks button element', async () => {
    const page = await browser.newPage();
    await page.setContent('<button id="test">Click</button>');

    const action = new ClickAction();
    const element = page.locator('#test');

    await action.execute(page, element, {
      event: 'click',
      bundle: { id: 'test', tag: 'button' }
    });

    // Verify click happened (would need event listener in real test)
  });

  it('handles checkbox toggle', async () => {
    const page = await browser.newPage();
    await page.setContent('<input type="checkbox" id="test">');

    const action = new ClickAction();
    const element = page.locator('#test');

    await action.execute(page, element, {
      event: 'click',
      bundle: { id: 'test', dataAttrs: { type: 'checkbox' } },
      value: 'true'
    });

    const isChecked = await element.isChecked();
    expect(isChecked).toBe(true);
  });
});

describe('InputAction', () => {
  it('fills input field', async () => {
    const page = await browser.newPage();
    await page.setContent('<input type="text" id="test">');

    const action = new InputAction();
    const element = page.locator('#test');

    await action.execute(page, element, {
      event: 'input',
      bundle: { id: 'test' },
      value: 'Hello World'
    });

    const value = await element.inputValue();
    expect(value).toBe('Hello World');
  });
});
```

### 10.2 Integration Tests
```typescript
describe('Action Integration', () => {
  it('executes form submission workflow', async () => {
    const page = await browser.newPage();
    await page.setContent(`
      <form>
        <input type="text" id="name">
        <input type="email" id="email">
        <button type="submit">Submit</button>
      </form>
    `);

    const registry = new ActionRegistry();

    // Input name
    await registry.execute(page, page.locator('#name'), {
      event: 'input',
      bundle: { id: 'name' },
      value: 'John Doe'
    });

    // Input email
    await registry.execute(page, page.locator('#email'), {
      event: 'input',
      bundle: { id: 'email' },
      value: 'john@example.com'
    });

    // Click submit
    await registry.execute(page, page.locator('button'), {
      event: 'click',
      bundle: { tag: 'button' }
    });

    // Verify values
    expect(await page.locator('#name').inputValue()).toBe('John Doe');
    expect(await page.locator('#email').inputValue()).toBe('john@example.com');
  });
});
```

---

## Summary

The Actions Library provides:
- ✅ **Action registry** with handler interface and plugin support
- ✅ **Click actions** (standard, checkbox, radio, button)
- ✅ **Input actions** (standard, contenteditable, React, Select2)
- ✅ **Select actions** (native, Select2, custom dropdowns)
- ✅ **Navigation actions** (goto, reload, back, forward)
- ✅ **Keyboard actions** (keypress, key combinations)
- ✅ **Framework adapters** (React, Vue, Angular)
- ✅ **Wait strategies** (element stability, network idle, animations)
- ✅ **Testing strategy** with unit and integration tests

This provides complete action execution for browser automation.
