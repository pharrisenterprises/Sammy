# Vision API Integration
**Project:** Chrome Extension Test Recorder - VDI Runner  
**Document Version:** 1.0  
**Last Updated:** November 25, 2025  
**Status:** Complete Technical Specification

## Table of Contents
1. Overview
2. API Configuration
3. Prompt Engineering
4. Request Building
5. Response Parsing
6. Coordinate Extraction
7. Selector Generation
8. Error Handling
9. Retry Strategy
10. Testing Strategy

---

## 1. Overview

### 1.1 Purpose

Vision API Integration connects to Claude's Vision capabilities to analyze screenshots and locate UI elements visually. This enables AI healing when traditional selectors fail.

### 1.2 Model Selection
```
Model: claude-3-5-sonnet-20241022
Reason: Best balance of vision accuracy and cost
Alternative: claude-3-opus (higher accuracy, 10x cost)
```

### 1.3 API Flow
```
Screenshot → Base64 Encode → Build Prompt → API Call → Parse JSON → Extract Coordinates
```

---

## 2. API Configuration

### 2.1 Client Setup
```typescript
// src/healing/vision-api-client.ts
import Anthropic from '@anthropic-ai/sdk';

export class VisionAPIClient {
  private client: Anthropic;
  private model: string = 'claude-3-5-sonnet-20241022';
  private maxTokens: number = 1024;

  constructor(apiKey: string) {
    this.client = new Anthropic({
      apiKey
    });
  }

  async analyze(
    screenshot: Buffer,
    step: RecordedStep
  ): Promise<VisionAPIResult> {
    const prompt = this.buildPrompt(step);
    const base64Image = screenshot.toString('base64');

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: base64Image
            }
          },
          {
            type: 'text',
            text: prompt
          }
        ]
      }]
    });

    return this.parseResponse(response);
  }
}
```

### 2.2 Environment Configuration
```typescript
// Environment variables
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Configuration interface
interface VisionAPIConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  timeout: number;        // Default: 30000ms
  retryAttempts: number;  // Default: 2
  retryDelay: number;     // Default: 1000ms
}

const defaultConfig: VisionAPIConfig = {
  apiKey: ANTHROPIC_API_KEY!,
  model: 'claude-3-5-sonnet-20241022',
  maxTokens: 1024,
  timeout: 30000,
  retryAttempts: 2,
  retryDelay: 1000
};
```

---

## 3. Prompt Engineering

### 3.1 Main Prompt Template
```typescript
private buildPrompt(step: RecordedStep): string {
  const elementType = this.getElementType(step.event);
  const label = step.label || 'unknown';
  const originalSelector = step.bundle.xpath || step.bundle.id || 'unknown';

  return `Analyze this webpage screenshot.

TASK: Find the element that matches this description:
- Action: ${step.event}
- Failed selector: ${originalSelector}
- Element type: ${elementType}
- Expected label: "${label}"

SEARCH CRITERIA:
1. Look for a ${elementType} with text or label similar to "${label}"
2. Consider the element type: ${this.getElementHints(step.event)}
3. The element should be visible and interactive

Return ONLY this JSON (no markdown, no explanation):
{
  "found": true/false,
  "confidence": 0-100,
  "bounding_box": {
    "x": number,
    "y": number,
    "width": number,
    "height": number
  },
  "element_type": "button" | "input" | "link" | "select" | "checkbox" | "radio",
  "text_content": "visible text on element",
  "reasoning": "brief explanation of why this element matches"
}

CRITICAL: Return ONLY valid JSON. No markdown code blocks. No additional text.`;
}
```

### 3.2 Element Type Hints
```typescript
private getElementType(event: string): string {
  const typeMap: Record<string, string> = {
    'click': 'button, link, or clickable element',
    'input': 'text input field or textarea',
    'select': 'dropdown or select element',
    'checkbox': 'checkbox input',
    'radio': 'radio button'
  };

  return typeMap[event] || 'interactive element';
}

private getElementHints(event: string): string {
  const hints: Record<string, string> = {
    'click': 'Look for buttons with text, icons, or links. May have hover states.',
    'input': 'Look for text fields with labels, placeholders, or borders.',
    'select': 'Look for dropdowns with arrows or expandable menus.',
    'checkbox': 'Look for square boxes that can be checked/unchecked.',
    'radio': 'Look for circular options in a group.'
  };

  return hints[event] || 'Look for any interactive element.';
}
```

### 3.3 Enhanced Prompt for Complex Cases
```typescript
private buildEnhancedPrompt(
  step: RecordedStep,
  context: HealingContext
): string {
  return `Analyze this webpage screenshot.

TASK: Find the element that matches this description:
- Action: ${step.event}
- Expected label: "${step.label}"
- Original position: x=${context.lastKnownPosition?.x}, y=${context.lastKnownPosition?.y}
- Page URL pattern: ${context.pageUrlPattern}

PREVIOUS CONTEXT:
- This element was previously found at the coordinates above
- The page structure may have changed
- Look for similar elements in the same general area

ELEMENT CHARACTERISTICS:
- Type: ${this.getElementType(step.event)}
- Expected text: "${step.label}"
- Tag hint: ${step.bundle.tag || 'unknown'}
- Class hint: ${step.bundle.className || 'unknown'}

Return ONLY this JSON:
{
  "found": true/false,
  "confidence": 0-100,
  "bounding_box": {
    "x": number,
    "y": number,
    "width": number,
    "height": number
  },
  "element_type": "button" | "input" | "link" | "select",
  "text_content": "visible text",
  "reasoning": "why this matches",
  "alternatives": [
    {
      "bounding_box": {...},
      "confidence": number,
      "text_content": "text"
    }
  ]
}

CRITICAL: Return ONLY valid JSON.`;
}
```

---

## 4. Request Building

### 4.1 Screenshot Preparation
```typescript
async prepareScreenshot(
  page: Page,
  step: RecordedStep
): Promise<Buffer> {
  // Scroll to expected location if known
  if (step.bundle.bounding) {
    await page.evaluate(({ x, y }) => {
      window.scrollTo({
        top: Math.max(0, y - 200),
        left: Math.max(0, x - 100),
        behavior: 'instant'
      });
    }, { x: step.bundle.bounding.x, y: step.bundle.bounding.y });

    await page.waitForTimeout(100);
  }

  // Capture viewport screenshot
  const screenshot = await page.screenshot({
    type: 'png',
    fullPage: false
  });

  // Resize for optimal API processing
  return this.optimizeForAPI(screenshot);
}

private async optimizeForAPI(buffer: Buffer): Promise<Buffer> {
  // Claude Vision works well with 1024x768
  // Resize if larger to reduce tokens/cost
  const sharp = require('sharp');

  const metadata = await sharp(buffer).metadata();

  if (metadata.width! > 1024 || metadata.height! > 768) {
    return sharp(buffer)
      .resize(1024, 768, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .png()
      .toBuffer();
  }

  return buffer;
}
```

### 4.2 Request Metadata
```typescript
interface APIRequest {
  screenshot: Buffer;
  step: RecordedStep;
  context: {
    pageUrl: string;
    viewport: { width: number; height: number };
    timestamp: string;
  };
}

async buildRequest(
  page: Page,
  step: RecordedStep
): Promise<APIRequest> {
  const screenshot = await this.prepareScreenshot(page, step);

  return {
    screenshot,
    step,
    context: {
      pageUrl: page.url(),
      viewport: page.viewportSize() || { width: 1920, height: 1080 },
      timestamp: new Date().toISOString()
    }
  };
}
```

---

## 5. Response Parsing

### 5.1 JSON Extraction
```typescript
private parseResponse(response: Anthropic.Message): VisionAPIResult {
  // Get text content from response
  const textContent = response.content.find(c => c.type === 'text');

  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Vision API');
  }

  let responseText = textContent.text;

  // Strip markdown code blocks if present
  responseText = responseText
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  // Parse JSON
  try {
    const parsed = JSON.parse(responseText);
    return this.validateResponse(parsed);

  } catch (error) {
    throw new Error(`Failed to parse Vision API response: ${error.message}`);
  }
}
```

### 5.2 Response Validation
```typescript
private validateResponse(parsed: any): VisionAPIResult {
  // Validate required fields
  if (typeof parsed.found !== 'boolean') {
    throw new Error('Missing or invalid "found" field');
  }

  if (!parsed.found) {
    return {
      found: false,
      confidence: 0,
      boundingBox: { x: 0, y: 0, width: 0, height: 0 },
      elementType: 'unknown',
      reasoning: parsed.reasoning || 'Element not found'
    };
  }

  // Validate bounding box
  if (!parsed.bounding_box ||
      typeof parsed.bounding_box.x !== 'number' ||
      typeof parsed.bounding_box.y !== 'number') {
    throw new Error('Invalid bounding_box format');
  }

  // Validate confidence
  const confidence = typeof parsed.confidence === 'number'
    ? Math.min(100, Math.max(0, parsed.confidence))
    : 0;

  return {
    found: true,
    confidence,
    boundingBox: {
      x: parsed.bounding_box.x,
      y: parsed.bounding_box.y,
      width: parsed.bounding_box.width || 50,
      height: parsed.bounding_box.height || 30
    },
    elementType: parsed.element_type || 'unknown',
    textContent: parsed.text_content,
    reasoning: parsed.reasoning || ''
  };
}
```

---

## 6. Coordinate Extraction

### 6.1 9-Point Grid Search
```typescript
// src/healing/coordinate-converter.ts
export class CoordinateConverter {
  async coordinatesToElement(
    page: Page,
    boundingBox: BoundingBox
  ): Promise<Element | null> {
    // Calculate center point
    const centerX = boundingBox.x + boundingBox.width / 2;
    const centerY = boundingBox.y + boundingBox.height / 2;

    // 9-point grid offsets
    const offsets = [
      [0, 0],      // Center
      [-5, -5],    // Top-left
      [0, -5],     // Top-center
      [5, -5],     // Top-right
      [-5, 0],     // Middle-left
      [5, 0],      // Middle-right
      [-5, 5],     // Bottom-left
      [0, 5],      // Bottom-center
      [5, 5]       // Bottom-right
    ];

    for (const [dx, dy] of offsets) {
      const x = centerX + dx;
      const y = centerY + dy;

      const element = await page.evaluate(({ x, y }) => {
        const el = document.elementFromPoint(x, y);

        if (!el) return null;

        return {
          tagName: el.tagName.toLowerCase(),
          id: el.id,
          className: el.className,
          textContent: el.textContent?.trim().substring(0, 100)
        };
      }, { x, y });

      if (element) {
        return element;
      }
    }

    return null;
  }
}
```

### 6.2 Element Verification
```typescript
async verifyElement(
  page: Page,
  boundingBox: BoundingBox,
  expectedType: string
): Promise<boolean> {
  const element = await this.coordinatesToElement(page, boundingBox);

  if (!element) return false;

  // Verify element type matches
  const typeMatches = this.elementTypeMatches(element.tagName, expectedType);

  if (!typeMatches) {
    console.warn(`Element type mismatch: found ${element.tagName}, expected ${expectedType}`);
  }

  return typeMatches;
}

private elementTypeMatches(tagName: string, expectedType: string): boolean {
  const typeMap: Record<string, string[]> = {
    'button': ['button', 'a', 'input', 'div', 'span'],
    'input': ['input', 'textarea'],
    'link': ['a', 'button'],
    'select': ['select', 'div'],
    'checkbox': ['input'],
    'radio': ['input']
  };

  const validTags = typeMap[expectedType] || [expectedType];
  return validTags.includes(tagName.toLowerCase());
}
```

---

## 7. Selector Generation

### 7.1 Generate Selector from Element
```typescript
async generateSelector(
  page: Page,
  boundingBox: BoundingBox
): Promise<string | null> {
  const selector = await page.evaluate(({ x, y, width, height }) => {
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const el = document.elementFromPoint(centerX, centerY);

    if (!el) return null;

    // Strategy 1: ID selector
    if (el.id) {
      return `#${el.id}`;
    }

    // Strategy 2: Unique class combination
    if (el.className && typeof el.className === 'string') {
      const classes = el.className.trim().split(/\s+/);
      if (classes.length > 0) {
        const selector = '.' + classes.join('.');
        const matches = document.querySelectorAll(selector);
        if (matches.length === 1) {
          return selector;
        }
      }
    }

    // Strategy 3: Data attributes
    const dataTestId = el.getAttribute('data-testid');
    if (dataTestId) {
      return `[data-testid="${dataTestId}"]`;
    }

    const dataCy = el.getAttribute('data-cy');
    if (dataCy) {
      return `[data-cy="${dataCy}"]`;
    }

    // Strategy 4: Tag + text content
    const text = el.textContent?.trim();
    if (text && text.length < 50) {
      const tag = el.tagName.toLowerCase();
      return `${tag}:has-text("${text.substring(0, 30)}")`;
    }

    // Strategy 5: XPath fallback
    const getXPath = (element: Element): string => {
      if (element.id) {
        return `//*[@id="${element.id}"]`;
      }

      const parts: string[] = [];
      let current: Element | null = element;

      while (current && current.nodeType === Node.ELEMENT_NODE) {
        let index = 1;
        let sibling = current.previousElementSibling;

        while (sibling) {
          if (sibling.tagName === current.tagName) {
            index++;
          }
          sibling = sibling.previousElementSibling;
        }

        const tagName = current.tagName.toLowerCase();
        parts.unshift(`${tagName}[${index}]`);
        current = current.parentElement;
      }

      return '/' + parts.join('/');
    };

    return getXPath(el);

  }, boundingBox);

  return selector;
}
```

### 7.2 Selector Validation
```typescript
async validateSelector(
  page: Page,
  selector: string
): Promise<boolean> {
  try {
    const locator = page.locator(selector);
    const count = await locator.count();

    if (count === 0) {
      console.warn(`Selector "${selector}" matched 0 elements`);
      return false;
    }

    if (count > 1) {
      console.warn(`Selector "${selector}" matched ${count} elements (not unique)`);
      // Still valid, but will use first match
    }

    // Verify element is visible
    const isVisible = await locator.first().isVisible();
    return isVisible;

  } catch (error) {
    console.error(`Selector validation failed: ${error.message}`);
    return false;
  }
}
```

---

## 8. Error Handling

### 8.1 Error Types
```typescript
enum VisionAPIError {
  NETWORK_ERROR = 'Network error',
  TIMEOUT = 'Request timeout',
  RATE_LIMITED = 'Rate limited',
  INVALID_RESPONSE = 'Invalid response',
  PARSING_FAILED = 'JSON parsing failed',
  AUTHENTICATION = 'Authentication failed',
  QUOTA_EXCEEDED = 'Quota exceeded'
}

class VisionAPIException extends Error {
  constructor(
    public type: VisionAPIError,
    message: string,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'VisionAPIException';
  }
}
```

### 8.2 Error Handler
```typescript
private handleAPIError(error: any): never {
  // Rate limiting
  if (error.status === 429) {
    throw new VisionAPIException(
      VisionAPIError.RATE_LIMITED,
      'API rate limit exceeded',
      true
    );
  }

  // Authentication
  if (error.status === 401) {
    throw new VisionAPIException(
      VisionAPIError.AUTHENTICATION,
      'Invalid API key',
      false
    );
  }

  // Timeout
  if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
    throw new VisionAPIException(
      VisionAPIError.TIMEOUT,
      'Request timed out',
      true
    );
  }

  // Network error
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    throw new VisionAPIException(
      VisionAPIError.NETWORK_ERROR,
      'Network connection failed',
      true
    );
  }

  // Generic error
  throw new VisionAPIException(
    VisionAPIError.INVALID_RESPONSE,
    error.message || 'Unknown API error',
    false
  );
}
```

---

## 9. Retry Strategy

### 9.1 Retry Logic
```typescript
async analyzeWithRetry(
  screenshot: Buffer,
  step: RecordedStep,
  maxRetries: number = 2
): Promise<VisionAPIResult> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await this.analyze(screenshot, step);

    } catch (error) {
      lastError = error;

      // Check if retryable
      if (error instanceof VisionAPIException && !error.retryable) {
        throw error;
      }

      // Last attempt
      if (attempt > maxRetries) {
        break;
      }

      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      console.warn(`Vision API attempt ${attempt} failed, retrying in ${delay}ms...`);

      await new Promise(r => setTimeout(r, delay));
    }
  }

  throw lastError || new Error('Vision API failed after retries');
}
```

### 9.2 Circuit Breaker
```typescript
export class VisionAPICircuitBreaker {
  private failures: number = 0;
  private lastFailure: number = 0;
  private isOpen: boolean = false;
  private threshold: number = 3;
  private resetTimeout: number = 60000; // 1 minute

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.isOpen) {
      if (Date.now() - this.lastFailure > this.resetTimeout) {
        // Try to close circuit (half-open state)
        this.isOpen = false;
        this.failures = 0;
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      this.failures = 0;
      return result;

    } catch (error) {
      this.failures++;
      this.lastFailure = Date.now();

      if (this.failures >= this.threshold) {
        this.isOpen = true;
        console.error('Circuit breaker opened');
      }

      throw error;
    }
  }
}
```

---

## 10. Testing Strategy

### 10.1 Unit Tests
```typescript
describe('VisionAPIClient', () => {
  it('builds correct prompt', () => {
    const client = new VisionAPIClient('test-key');
    const step = {
      event: 'click',
      label: 'Submit Button',
      bundle: { xpath: '//button[@id="submit"]' }
    };

    const prompt = client['buildPrompt'](step);

    expect(prompt).toContain('Submit Button');
    expect(prompt).toContain('button');
    expect(prompt).toContain('JSON');
  });

  it('parses valid response', () => {
    const response = {
      content: [{
        type: 'text',
        text: JSON.stringify({
          found: true,
          confidence: 85,
          bounding_box: { x: 100, y: 200, width: 50, height: 30 },
          element_type: 'button',
          reasoning: 'Found button with matching text'
        })
      }]
    };

    const result = client['parseResponse'](response);

    expect(result.found).toBe(true);
    expect(result.confidence).toBe(85);
    expect(result.boundingBox.x).toBe(100);
  });

  it('handles markdown-wrapped response', () => {
    const response = {
      content: [{
        type: 'text',
        text: '```json\n{"found": true, "confidence": 90}\n```'
      }]
    };

    const result = client['parseResponse'](response);

    expect(result.found).toBe(true);
  });
});
```

### 10.2 Integration Tests
```typescript
describe('Vision API Integration', () => {
  it('analyzes screenshot and returns coordinates', async () => {
    const page = await browser.newPage();
    await page.setContent(`
      <button id="submit">Click Me</button>
    `);

    const screenshot = await page.screenshot({ type: 'png' });
    const client = new VisionAPIClient(process.env.ANTHROPIC_API_KEY!);

    const result = await client.analyze(screenshot, {
      event: 'click',
      label: 'Click Me',
      bundle: {}
    });

    expect(result.found).toBe(true);
    expect(result.confidence).toBeGreaterThan(50);
  });
});
```

---

## Summary

Vision API Integration provides:
- ✅ **Client configuration** with Anthropic SDK
- ✅ **Prompt engineering** for element detection
- ✅ **Screenshot preparation** with optimization
- ✅ **Response parsing** with markdown stripping
- ✅ **Coordinate extraction** with 9-point grid search
- ✅ **Selector generation** (ID, class, data-attr, XPath)
- ✅ **Error handling** with typed exceptions
- ✅ **Retry strategy** with exponential backoff
- ✅ **Circuit breaker** for failure protection
- ✅ **Testing strategy** with unit and integration tests

This enables AI-powered visual element detection for healing.
