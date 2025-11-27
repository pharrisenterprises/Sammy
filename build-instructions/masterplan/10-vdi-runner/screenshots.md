# Screenshots
**Project:** Chrome Extension Test Recorder - VDI Runner  
**Document Version:** 1.0  
**Last Updated:** November 25, 2025  
**Status:** Complete Technical Specification

## Table of Contents
1. Overview
2. Capture Types
3. Error Screenshots
4. Element Screenshots
5. Full-Page Screenshots
6. AI Healing Screenshots
7. Storage Strategy
8. Image Processing
9. Retrieval API
10. Testing Strategy

---

## 1. Overview

### 1.1 Purpose

Screenshots provide visual documentation of test execution, error diagnosis, and AI healing context. They are captured on errors, for debugging, and as input for Claude Vision API.

### 1.2 Screenshot Use Cases

| Use Case | Trigger | Purpose |
|----------|---------|---------|
| **Error Capture** | Step failure | Debug failed steps |
| **Element Highlight** | AI healing | Show target element context |
| **Full Page** | Before/after actions | Execution audit trail |
| **Viewport** | Element not found | AI healing input |
| **Video** | Recording (Phase 2) | Full execution replay |

### 1.3 Design Principles
```
1. DIAGNOSTIC VALUE
   - Capture context, not just element
   - Include timestamp and step info
   - Highlight relevant areas

2. STORAGE EFFICIENCY
   - Compress images
   - Clean up old screenshots
   - Use signed URLs for access

3. AI INTEGRATION
   - Format for Claude Vision
   - Include bounding box context
   - Provide enough page context

4. SECURITY
   - Signed URLs with expiration
   - No sensitive data in filenames
   - Automatic cleanup
```

---

## 2. Capture Types

### 2.1 Screenshot Types
```typescript
type ScreenshotType =
  | 'error'           // Step failure screenshot
  | 'element'         // Element with context
  | 'fullpage'        // Entire page
  | 'viewport'        // Visible viewport only
  | 'healing';        // AI healing input

interface ScreenshotOptions {
  type: ScreenshotType;
  fullPage?: boolean;
  clip?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  quality?: number;     // JPEG quality (0-100)
  format?: 'png' | 'jpeg';
  highlight?: {
    selector: string;
    color: string;
  };
}
```

### 2.2 Screenshot Metadata
```typescript
interface ScreenshotMetadata {
  id: string;
  jobId: string;
  stepNumber: number;
  type: ScreenshotType;
  fileName: string;
  url?: string;           // Signed URL
  timestamp: string;
  pageUrl: string;
  pageTitle: string;
  viewport: {
    width: number;
    height: number;
  };
  elementBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  errorMessage?: string;
}
```

---

## 3. Error Screenshots

### 3.1 Error Capture Service
```typescript
// src/screenshots/error-capture.ts
import { Page } from 'playwright';

export class ErrorCaptureService {
  private supabase;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async captureError(
    page: Page,
    step: RecordedStep,
    jobId: string,
    error: Error
  ): Promise<ScreenshotMetadata> {
    const timestamp = Date.now();
    const fileName = this.generateFileName(jobId, step.stepNumber, timestamp);

    // Capture full page screenshot
    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: true
    });

    // Upload to Supabase Storage
    const { error: uploadError } = await this.supabase.storage
      .from('screenshots')
      .upload(fileName, screenshot, {
        contentType: 'image/png',
        upsert: false
      });

    if (uploadError) {
      console.error('Screenshot upload failed:', uploadError);
      throw uploadError;
    }

    // Create metadata record
    const metadata: ScreenshotMetadata = {
      id: `screenshot-${timestamp}`,
      jobId,
      stepNumber: step.stepNumber,
      type: 'error',
      fileName,
      timestamp: new Date().toISOString(),
      pageUrl: page.url(),
      pageTitle: await page.title(),
      viewport: page.viewportSize() || { width: 0, height: 0 },
      errorMessage: error.message
    };

    // Save metadata to database
    await this.saveMetadata(metadata);

    console.log(`📸 Error screenshot captured: ${fileName}`);

    return metadata;
  }

  private generateFileName(
    jobId: string,
    stepNumber: number,
    timestamp: number
  ): string {
    return `${jobId}/error_step-${stepNumber}_${timestamp}.png`;
  }

  private async saveMetadata(metadata: ScreenshotMetadata): Promise<void> {
    await this.supabase
      .from('screenshot_metadata')
      .insert(metadata);
  }
}
```

### 3.2 Error Context Capture
```typescript
async captureErrorWithContext(
  page: Page,
  step: RecordedStep,
  jobId: string,
  error: Error
): Promise<ScreenshotMetadata[]> {
  const screenshots: ScreenshotMetadata[] = [];

  // 1. Full page screenshot
  const fullPage = await this.captureError(page, step, jobId, error);
  screenshots.push(fullPage);

  // 2. Viewport screenshot
  const viewport = await this.captureViewport(page, step, jobId);
  screenshots.push(viewport);

  // 3. Element context if locatable
  try {
    const elementContext = await this.captureElementContext(
      page,
      step,
      jobId
    );
    screenshots.push(elementContext);
  } catch (err) {
    // Element not found - skip element screenshot
    console.warn('Could not capture element context:', err);
  }

  return screenshots;
}
```

---

## 4. Element Screenshots

### 4.1 Element Capture Service
```typescript
// src/screenshots/element-capture.ts
export class ElementCaptureService {
  async captureElement(
    page: Page,
    selector: string,
    jobId: string,
    stepNumber: number
  ): Promise<ScreenshotMetadata> {
    const element = page.locator(selector);

    // Get element bounding box
    const box = await element.boundingBox();

    if (!box) {
      throw new Error('Element has no bounding box');
    }

    // Capture element screenshot
    const screenshot = await element.screenshot({
      type: 'png'
    });

    const fileName = `${jobId}/element_step-${stepNumber}_${Date.now()}.png`;

    await this.uploadScreenshot(fileName, screenshot);

    return {
      id: `element-${Date.now()}`,
      jobId,
      stepNumber,
      type: 'element',
      fileName,
      timestamp: new Date().toISOString(),
      pageUrl: page.url(),
      pageTitle: await page.title(),
      viewport: page.viewportSize() || { width: 0, height: 0 },
      elementBounds: box
    };
  }

  async captureElementWithContext(
    page: Page,
    selector: string,
    jobId: string,
    stepNumber: number,
    contextPadding: number = 300
  ): Promise<ScreenshotMetadata> {
    const element = page.locator(selector);
    const box = await element.boundingBox();

    if (!box) {
      throw new Error('Element has no bounding box');
    }

    // Calculate clip region with context padding
    const clip = {
      x: Math.max(0, box.x - contextPadding),
      y: Math.max(0, box.y - contextPadding),
      width: box.width + contextPadding * 2,
      height: box.height + contextPadding * 2
    };

    // Capture with context
    const screenshot = await page.screenshot({
      type: 'png',
      clip
    });

    const fileName = `${jobId}/element_context_step-${stepNumber}_${Date.now()}.png`;

    await this.uploadScreenshot(fileName, screenshot);

    return {
      id: `element-context-${Date.now()}`,
      jobId,
      stepNumber,
      type: 'element',
      fileName,
      timestamp: new Date().toISOString(),
      pageUrl: page.url(),
      pageTitle: await page.title(),
      viewport: page.viewportSize() || { width: 0, height: 0 },
      elementBounds: box
    };
  }
}
```

### 4.2 Element Highlighting
```typescript
async captureWithHighlight(
  page: Page,
  selector: string,
  highlightColor: string = 'rgba(255, 0, 0, 0.5)'
): Promise<Buffer> {
  // Add highlight overlay
  await page.evaluate(
    ({ selector, color }) => {
      const element = document.querySelector(selector);
      if (element) {
        const overlay = document.createElement('div');
        overlay.id = '__highlight_overlay__';
        overlay.style.cssText = `
          position: absolute;
          pointer-events: none;
          z-index: 999999;
          background-color: ${color};
          border: 2px solid red;
        `;

        const rect = element.getBoundingClientRect();
        overlay.style.left = `${rect.left + window.scrollX}px`;
        overlay.style.top = `${rect.top + window.scrollY}px`;
        overlay.style.width = `${rect.width}px`;
        overlay.style.height = `${rect.height}px`;

        document.body.appendChild(overlay);
      }
    },
    { selector, color: highlightColor }
  );

  // Capture screenshot
  const screenshot = await page.screenshot({ type: 'png', fullPage: true });

  // Remove highlight overlay
  await page.evaluate(() => {
    const overlay = document.getElementById('__highlight_overlay__');
    if (overlay) {
      overlay.remove();
    }
  });

  return screenshot;
}
```

---

## 5. Full-Page Screenshots

### 5.1 Full Page Capture
```typescript
// src/screenshots/fullpage-capture.ts
export class FullPageCaptureService {
  async captureFullPage(
    page: Page,
    jobId: string,
    stepNumber: number,
    label: string = ''
  ): Promise<ScreenshotMetadata> {
    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: true
    });

    const fileName = `${jobId}/fullpage_step-${stepNumber}_${label}_${Date.now()}.png`;

    await this.uploadScreenshot(fileName, screenshot);

    return {
      id: `fullpage-${Date.now()}`,
      jobId,
      stepNumber,
      type: 'fullpage',
      fileName,
      timestamp: new Date().toISOString(),
      pageUrl: page.url(),
      pageTitle: await page.title(),
      viewport: page.viewportSize() || { width: 0, height: 0 }
    };
  }

  async captureBeforeAfter(
    page: Page,
    jobId: string,
    stepNumber: number,
    action: () => Promise<void>
  ): Promise<{ before: ScreenshotMetadata; after: ScreenshotMetadata }> {
    // Capture before
    const before = await this.captureFullPage(
      page,
      jobId,
      stepNumber,
      'before'
    );

    // Execute action
    await action();

    // Wait for any animations
    await page.waitForTimeout(500);

    // Capture after
    const after = await this.captureFullPage(
      page,
      jobId,
      stepNumber,
      'after'
    );

    return { before, after };
  }
}
```

---

## 6. AI Healing Screenshots

### 6.1 Healing Screenshot Service
```typescript
// src/screenshots/healing-capture.ts
export class HealingCaptureService {
  async captureForHealing(
    page: Page,
    step: RecordedStep,
    jobId: string
  ): Promise<HealingScreenshot> {
    // Get expected element bounds from step
    const expectedBounds = step.bundle.bounding;

    // Capture viewport-sized screenshot (for Claude Vision)
    const screenshot = await this.captureViewportWithContext(
      page,
      expectedBounds
    );

    const fileName = `${jobId}/healing_step-${step.stepNumber}_${Date.now()}.png`;

    await this.uploadScreenshot(fileName, screenshot.buffer);

    // Generate signed URL for Claude API
    const signedUrl = await this.generateSignedUrl(fileName);

    return {
      fileName,
      signedUrl,
      viewport: screenshot.viewport,
      expectedBounds,
      pageUrl: page.url(),
      timestamp: new Date().toISOString()
    };
  }

  private async captureViewportWithContext(
    page: Page,
    expectedBounds?: BoundingBox
  ): Promise<{ buffer: Buffer; viewport: { width: number; height: number } }> {
    // If expected bounds provided, scroll to that area
    if (expectedBounds) {
      await page.evaluate(({ x, y }) => {
        window.scrollTo({
          top: Math.max(0, y - 200),
          left: Math.max(0, x - 100),
          behavior: 'instant'
        });
      }, { x: expectedBounds.x, y: expectedBounds.y });

      await page.waitForTimeout(100);
    }

    // Capture current viewport
    const buffer = await page.screenshot({
      type: 'png',
      fullPage: false
    });

    const viewport = page.viewportSize() || { width: 1920, height: 1080 };

    return { buffer, viewport };
  }

  private async generateSignedUrl(fileName: string): Promise<string> {
    const { data } = await this.supabase.storage
      .from('screenshots')
      .createSignedUrl(fileName, 3600); // 1 hour expiration

    return data?.signedUrl || '';
  }
}

interface HealingScreenshot {
  fileName: string;
  signedUrl: string;
  viewport: { width: number; height: number };
  expectedBounds?: BoundingBox;
  pageUrl: string;
  timestamp: string;
}
```

### 6.2 Format for Claude Vision
```typescript
async formatForClaudeVision(
  screenshot: HealingScreenshot,
  step: RecordedStep
): Promise<ClaudeVisionInput> {
  // Download screenshot for base64 encoding
  const { data } = await this.supabase.storage
    .from('screenshots')
    .download(screenshot.fileName);

  if (!data) {
    throw new Error('Failed to download screenshot');
  }

  // Convert to base64
  const arrayBuffer = await data.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');

  return {
    type: 'image',
    source: {
      type: 'base64',
      media_type: 'image/png',
      data: base64
    },
    metadata: {
      viewport: screenshot.viewport,
      expectedBounds: screenshot.expectedBounds,
      stepLabel: step.label,
      originalSelector: step.bundle.xpath || step.bundle.id,
      elementType: step.bundle.tag
    }
  };
}

interface ClaudeVisionInput {
  type: 'image';
  source: {
    type: 'base64';
    media_type: 'image/png';
    data: string;
  };
  metadata: {
    viewport: { width: number; height: number };
    expectedBounds?: BoundingBox;
    stepLabel: string;
    originalSelector?: string;
    elementType?: string;
  };
}
```

---

## 7. Storage Strategy

### 7.1 Supabase Storage Configuration
```typescript
// Storage bucket configuration
const SCREENSHOTS_BUCKET = 'screenshots';

// Folder structure:
// screenshots/
//   {jobId}/
//     error_step-{N}_{timestamp}.png
//     element_step-{N}_{timestamp}.png
//     fullpage_step-{N}_{timestamp}.png
//     healing_step-{N}_{timestamp}.png
```

### 7.2 Storage Manager
```typescript
// src/screenshots/storage-manager.ts
export class ScreenshotStorageManager {
  private supabase;
  private bucket = 'screenshots';

  async upload(
    fileName: string,
    data: Buffer,
    contentType: string = 'image/png'
  ): Promise<string> {
    const { error } = await this.supabase.storage
      .from(this.bucket)
      .upload(fileName, data, {
        contentType,
        upsert: false
      });

    if (error) {
      throw error;
    }

    return fileName;
  }

  async getSignedUrl(
    fileName: string,
    expiresIn: number = 3600
  ): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .createSignedUrl(fileName, expiresIn);

    if (error) {
      throw error;
    }

    return data.signedUrl;
  }

  async delete(fileName: string): Promise<void> {
    await this.supabase.storage
      .from(this.bucket)
      .remove([fileName]);
  }

  async deleteJobScreenshots(jobId: string): Promise<void> {
    // List all files for job
    const { data: files } = await this.supabase.storage
      .from(this.bucket)
      .list(jobId);

    if (files && files.length > 0) {
      const fileNames = files.map(f => `${jobId}/${f.name}`);
      await this.supabase.storage
        .from(this.bucket)
        .remove(fileNames);
    }
  }
}
```

### 7.3 Cleanup Policy
```typescript
export class ScreenshotCleanup {
  async cleanupOldScreenshots(daysToKeep: number = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    // Get old screenshot metadata
    const { data: oldScreenshots } = await this.supabase
      .from('screenshot_metadata')
      .select('fileName, id')
      .lt('timestamp', cutoffDate.toISOString());

    if (!oldScreenshots || oldScreenshots.length === 0) {
      return 0;
    }

    // Delete from storage
    const fileNames = oldScreenshots.map(s => s.fileName);
    await this.supabase.storage
      .from('screenshots')
      .remove(fileNames);

    // Delete metadata
    const ids = oldScreenshots.map(s => s.id);
    await this.supabase
      .from('screenshot_metadata')
      .delete()
      .in('id', ids);

    console.log(`🗑️  Cleaned up ${oldScreenshots.length} old screenshots`);

    return oldScreenshots.length;
  }
}
```

---

## 8. Image Processing

### 8.1 Image Compression
```typescript
import sharp from 'sharp';

export class ImageProcessor {
  async compressScreenshot(
    buffer: Buffer,
    options: CompressionOptions = {}
  ): Promise<Buffer> {
    const {
      quality = 80,
      maxWidth = 1920,
      maxHeight = 1080,
      format = 'png'
    } = options;

    let processor = sharp(buffer);

    // Resize if too large
    const metadata = await processor.metadata();

    if (
      (metadata.width && metadata.width > maxWidth) ||
      (metadata.height && metadata.height > maxHeight)
    ) {
      processor = processor.resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    // Apply format-specific compression
    if (format === 'jpeg') {
      return processor.jpeg({ quality }).toBuffer();
    } else {
      return processor.png({ compressionLevel: 9 }).toBuffer();
    }
  }

  async resizeForAI(buffer: Buffer): Promise<Buffer> {
    // Claude Vision works best with specific dimensions
    return sharp(buffer)
      .resize(1024, 768, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .png({ compressionLevel: 6 })
      .toBuffer();
  }
}

interface CompressionOptions {
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  format?: 'png' | 'jpeg';
}
```

### 8.2 Annotation
```typescript
async annotateScreenshot(
  buffer: Buffer,
  annotations: Annotation[]
): Promise<Buffer> {
  let image = sharp(buffer);
  const metadata = await image.metadata();

  // Create SVG overlay with annotations
  const svgOverlay = this.createAnnotationSvg(
    annotations,
    metadata.width || 0,
    metadata.height || 0
  );

  // Composite annotation layer
  return image
    .composite([
      {
        input: Buffer.from(svgOverlay),
        top: 0,
        left: 0
      }
    ])
    .toBuffer();
}

private createAnnotationSvg(
  annotations: Annotation[],
  width: number,
  height: number
): string {
  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;

  for (const ann of annotations) {
    if (ann.type === 'rectangle') {
      svg += `
        <rect 
          x="${ann.x}" 
          y="${ann.y}" 
          width="${ann.width}" 
          height="${ann.height}" 
          fill="none" 
          stroke="${ann.color || 'red'}" 
          stroke-width="3" 
        />
      `;
    } else if (ann.type === 'text') {
      svg += `
        <text 
          x="${ann.x}" 
          y="${ann.y}" 
          fill="${ann.color || 'red'}" 
          font-size="20" 
          font-weight="bold"
        >
          ${ann.text}
        </text>
      `;
    }
  }

  svg += '</svg>';
  return svg;
}

interface Annotation {
  type: 'rectangle' | 'circle' | 'text' | 'arrow';
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  color?: string;
}
```

---

## 9. Retrieval API

### 9.1 Screenshot Retrieval Service
```typescript
// src/screenshots/retrieval-service.ts
export class ScreenshotRetrievalService {
  async getJobScreenshots(jobId: string): Promise<ScreenshotMetadata[]> {
    const { data, error } = await this.supabase
      .from('screenshot_metadata')
      .select('*')
      .eq('jobId', jobId)
      .order('stepNumber', { ascending: true });

    if (error) {
      throw error;
    }

    // Generate signed URLs
    for (const screenshot of data || []) {
      screenshot.url = await this.getSignedUrl(screenshot.fileName);
    }

    return data || [];
  }

  async getStepScreenshots(
    jobId: string,
    stepNumber: number
  ): Promise<ScreenshotMetadata[]> {
    const { data } = await this.supabase
      .from('screenshot_metadata')
      .select('*')
      .eq('jobId', jobId)
      .eq('stepNumber', stepNumber);

    // Generate signed URLs
    for (const screenshot of data || []) {
      screenshot.url = await this.getSignedUrl(screenshot.fileName);
    }

    return data || [];
  }

  async getErrorScreenshots(jobId: string): Promise<ScreenshotMetadata[]> {
    const { data } = await this.supabase
      .from('screenshot_metadata')
      .select('*')
      .eq('jobId', jobId)
      .eq('type', 'error');

    // Generate signed URLs
    for (const screenshot of data || []) {
      screenshot.url = await this.getSignedUrl(screenshot.fileName);
    }

    return data || [];
  }
}
```

---

## 10. Testing Strategy

### 10.1 Unit Tests
```typescript
describe('ErrorCaptureService', () => {
  it('captures error screenshot', async () => {
    const page = await browser.newPage();
    await page.goto('https://example.com');

    const service = new ErrorCaptureService(supabase);
    const metadata = await service.captureError(
      page,
      { stepNumber: 1, label: 'Test step' },
      'job-123',
      new Error('Element not found')
    );

    expect(metadata.type).toBe('error');
    expect(metadata.fileName).toContain('job-123');
    expect(metadata.errorMessage).toBe('Element not found');
  });
});

describe('ImageProcessor', () => {
  it('compresses screenshot', async () => {
    const original = await fs.readFile('test-screenshot.png');
    const processor = new ImageProcessor();

    const compressed = await processor.compressScreenshot(original, {
      quality: 60
    });

    expect(compressed.length).toBeLessThan(original.length);
  });
});
```

### 10.2 Integration Tests
```typescript
describe('Screenshot Integration', () => {
  it('captures and retrieves screenshots', async () => {
    const page = await browser.newPage();
    await page.goto('https://example.com');

    const captureService = new ErrorCaptureService(supabase);
    const retrievalService = new ScreenshotRetrievalService(supabase);

    // Capture
    await captureService.captureError(
      page,
      { stepNumber: 1 },
      'job-test',
      new Error('Test error')
    );

    // Retrieve
    const screenshots = await retrievalService.getJobScreenshots('job-test');

    expect(screenshots.length).toBe(1);
    expect(screenshots[0].url).toContain('signed');

    // Cleanup
    await storageManager.deleteJobScreenshots('job-test');
  });
});
```

---

## Summary

Screenshots provide:
- ✅ **Error capture** with full page and context screenshots
- ✅ **Element screenshots** with highlight and context padding
- ✅ **Full-page screenshots** with before/after capture
- ✅ **AI healing screenshots** formatted for Claude Vision
- ✅ **Storage strategy** with Supabase and signed URLs
- ✅ **Image processing** with compression and annotation
- ✅ **Cleanup policy** for old screenshots
- ✅ **Retrieval API** for accessing screenshots
- ✅ **Testing strategy** with unit and integration tests

This provides complete visual documentation and AI healing support.
