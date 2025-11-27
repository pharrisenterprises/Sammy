# AI Healing Overview
**Project:** Chrome Extension Test Recorder - VDI Runner  
**Document Version:** 1.0  
**Last Updated:** November 25, 2025  
**Status:** Complete Technical Specification

## Table of Contents
1. Overview
2. Architecture
3. Trigger Conditions
4. Healing Flow
5. Component Structure
6. Rate Limiting
7. Fallback Strategy
8. Monitoring
9. Cost Management
10. Testing Strategy

---

## 1. Overview

### 1.1 Purpose

AI Healing automatically recovers from element-not-found errors by using Claude Vision API to locate elements visually when all 9 locator strategies fail. This enables resilient test execution despite DOM changes.

### 1.2 Key Capabilities

- **Visual Element Detection**: Use Claude Vision to find elements by appearance
- **Automatic Recovery**: Auto-apply high-confidence healings without user intervention
- **Selector Generation**: Convert coordinates back to usable CSS/XPath selectors
- **Learning**: Cache successful healings for future executions
- **Cost Control**: Multi-layered caching and rate limiting

### 1.3 Design Principles
```
1. RESILIENCE
   - Recover from DOM changes automatically
   - Multiple fallback layers
   - Graceful degradation

2. ACCURACY
   - High confidence threshold for auto-apply
   - Validation before applying healed selector
   - Success tracking for cached healings

3. COST EFFICIENCY
   - Aggressive caching (24-hour TTL)
   - Batch similar requests
   - Circuit breaker on failures

4. TRANSPARENCY
   - Log all healing attempts
   - Track confidence scores
   - Notify users of applied healings
```

---

## 2. Architecture

### 2.1 System Context
```
┌─────────────────────────────────────────────────────────────────┐
│                    ELEMENT LOCATOR                              │
│                                                                 │
│  9-Tier Strategy:                                               │
│  XPath → ID → Name → ARIA → Placeholder →                      │
│  DataAttr → FuzzyText → BoundingBox → Retry                    │
│                                                                 │
│  ALL STRATEGIES FAILED                                          │
└───────────────────────────┬─────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                    AI HEALING SYSTEM                            │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ 1. HEALING CACHE CHECK                                   │  │
│  │                                                          │  │
│  │  Key: pageURL + stepType + fieldLabel + selectorHash     │  │
│  │  If HIT && success_rate > 0.7 → Use cached selector     │  │
│  │  If MISS → Continue to Vision API                        │  │
│  └─────────────────────────────────────────────────────────┘  │
│                            ↓                                    │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ 2. SCREENSHOT CAPTURE                                    │  │
│  │                                                          │  │
│  │  • Viewport screenshot (1024x768)                        │  │
│  │  • Scroll to expected bounding box area                 │  │
│  │  • Add 300px context padding                            │  │
│  └─────────────────────────────────────────────────────────┘  │
│                            ↓                                    │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ 3. CLAUDE VISION API                                     │  │
│  │                                                          │  │
│  │  Model: claude-3-5-sonnet-20241022                       │  │
│  │  Input: Screenshot + step metadata                       │  │
│  │  Output: { found, confidence, bounding_box, reasoning }  │  │
│  └─────────────────────────────────────────────────────────┘  │
│                            ↓                                    │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ 4. COORDINATE TO SELECTOR                                │  │
│  │                                                          │  │
│  │  • Use elementFromPoint() at returned coordinates        │  │
│  │  • Try 9-point grid search around coordinates           │  │
│  │  • Generate CSS/XPath selector from found element       │  │
│  └─────────────────────────────────────────────────────────┘  │
│                            ↓                                    │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ 5. CONFIDENCE EVALUATION                                 │  │
│  │                                                          │  │
│  │  ≥ 80%: Auto-apply healing                              │  │
│  │  60-79%: Apply + flag for review                        │  │
│  │  < 60%: Suggest only (don't apply)                      │  │
│  └─────────────────────────────────────────────────────────┘  │
│                            ↓                                    │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ 6. CACHE UPDATE                                          │  │
│  │                                                          │  │
│  │  • Store healed selector with confidence                │  │
│  │  • Track success/failure counts                         │  │
│  │  • TTL: 24 hours                                        │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Component Diagram
```
AIHealingSystem
├── HealingCache
│   ├── CacheKeyGenerator
│   ├── CacheStorage (Supabase)
│   └── SuccessTracker
├── VisionAPIClient
│   ├── PromptBuilder
│   ├── ResponseParser
│   └── RateLimiter
├── CoordinateConverter
│   ├── ElementFromPoint
│   ├── GridSearch
│   └── SelectorGenerator
├── ConfidenceEvaluator
│   ├── ThresholdChecker
│   └── ActionDecider
└── HealingLogger
    ├── AttemptLogger
    └── MetricsCollector
```

---

## 3. Trigger Conditions

### 3.1 When Healing Triggers
```typescript
interface HealingTrigger {
  condition: 'all_strategies_failed';
  strategies_tried: number;  // Must be 9
  last_error: string;        // e.g., "Element not found"
  step_type: string;         // click, input, select
}

function shouldTriggerHealing(
  error: Error,
  strategiesTried: number,
  healingEnabled: boolean
): boolean {
  // Healing must be enabled
  if (!healingEnabled) return false;

  // All 9 strategies must have failed
  if (strategiesTried < 9) return false;

  // Error must be element-not-found type
  const healableErrors = [
    'Element not found',
    'Timeout exceeded',
    'No element matches selector'
  ];

  return healableErrors.some(msg => error.message.includes(msg));
}
```

### 3.2 When Healing Does NOT Trigger
```typescript
const HEALING_EXCLUSIONS = [
  // Navigation errors
  'Navigation failed',
  'net::ERR_CONNECTION_REFUSED',

  // JavaScript errors
  'Execution context was destroyed',
  'Script error',

  // Permission errors
  'Permission denied',

  // Already healed this step
  'Healing already attempted'
];
```

---

## 4. Healing Flow

### 4.1 Complete Flow
```typescript
// src/healing/healing-service.ts
export class AIHealingService {
  private cache: HealingCache;
  private visionAPI: VisionAPIClient;
  private converter: CoordinateConverter;
  private evaluator: ConfidenceEvaluator;
  private logger: HealingLogger;

  async attemptHealing(
    page: Page,
    step: RecordedStep,
    jobId: string
  ): Promise<HealingResult> {
    // Step 1: Check cache first
    const cacheKey = this.generateCacheKey(step, page.url());
    const cached = await this.cache.get(cacheKey);

    if (cached && cached.successRate > 0.7) {
      await this.logger.log(jobId, 'Cache hit', cached);

      return {
        success: true,
        source: 'cache',
        selector: cached.healedSelector,
        confidence: cached.confidence
      };
    }

    // Step 2: Capture screenshot
    const screenshot = await this.captureHealingScreenshot(page, step);

    // Step 3: Call Claude Vision API
    const visionResult = await this.visionAPI.analyze(screenshot, step);

    if (!visionResult.found) {
      await this.logger.logFailure(jobId, step, 'Element not found by AI');

      return { success: false, reason: 'AI could not locate element' };
    }

    // Step 4: Convert coordinates to selector
    const selector = await this.converter.coordinatesToSelector(
      page,
      visionResult.boundingBox
    );

    if (!selector) {
      await this.logger.logFailure(jobId, step, 'Could not generate selector');

      return { success: false, reason: 'Selector generation failed' };
    }

    // Step 5: Evaluate confidence
    const action = this.evaluator.decide(visionResult.confidence);

    // Step 6: Apply based on confidence
    if (action === 'auto_apply' || action === 'apply_with_flag') {
      // Validate selector works
      const valid = await this.validateSelector(page, selector);

      if (valid) {
        // Update cache
        await this.cache.set(cacheKey, {
          originalSelector: step.bundle.xpath || '',
          healedSelector: selector,
          confidence: visionResult.confidence,
          timestamp: new Date()
        });

        // Log healing
        await this.logger.logSuccess(jobId, step, selector, visionResult);

        return {
          success: true,
          source: 'vision_api',
          selector,
          confidence: visionResult.confidence,
          flagged: action === 'apply_with_flag'
        };
      }
    }

    // Step 6b: Suggest only (low confidence)
    await this.logger.logSuggestion(jobId, step, selector, visionResult);

    return {
      success: false,
      suggestion: selector,
      confidence: visionResult.confidence,
      reason: 'Confidence too low for auto-apply'
    };
  }
}
```

### 4.2 Flow Diagram
```
START
  │
  ▼
[Check Cache] ──── HIT ────→ [Use Cached Selector] ──→ SUCCESS
  │
  │ MISS
  ▼
[Capture Screenshot]
  │
  ▼
[Call Claude Vision API]
  │
  ├── NOT FOUND ──→ [Log Failure] ──→ FAIL
  │
  │ FOUND
  ▼
[Convert Coordinates to Selector]
  │
  ├── FAILED ──→ [Log Failure] ──→ FAIL
  │
  │ SUCCESS
  ▼
[Evaluate Confidence]
  │
  ├── ≥ 80% ──→ [Auto-Apply] ──→ [Update Cache] ──→ SUCCESS
  │
  ├── 60-79% ──→ [Apply + Flag] ──→ [Update Cache] ──→ SUCCESS (flagged)
  │
  └── < 60% ──→ [Suggest Only] ──→ [Log Suggestion] ──→ FAIL
```

---

## 5. Component Structure

### 5.1 Project Structure
```
vdi-runner/
├── src/
│   ├── healing/
│   │   ├── healing-service.ts       # Main orchestrator
│   │   ├── healing-cache.ts         # Caching layer
│   │   ├── vision-api-client.ts     # Claude API integration
│   │   ├── coordinate-converter.ts  # Coords to selector
│   │   ├── confidence-evaluator.ts  # Threshold logic
│   │   ├── healing-logger.ts        # Logging
│   │   └── types.ts                 # TypeScript interfaces
│   └── ...
```

### 5.2 Interfaces
```typescript
// src/healing/types.ts
interface HealingResult {
  success: boolean;
  source?: 'cache' | 'vision_api';
  selector?: string;
  confidence?: number;
  flagged?: boolean;
  suggestion?: string;
  reason?: string;
}

interface VisionAPIResult {
  found: boolean;
  confidence: number;          // 0-100
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  elementType: string;         // button, input, link
  textContent?: string;
  reasoning: string;
}

interface CachedHealing {
  originalSelector: string;
  healedSelector: string;
  confidence: number;
  timestamp: Date;
  successCount: number;
  failureCount: number;
  successRate: number;
}

interface HealingLogEntry {
  id: string;
  jobId: string;
  recordingId: string;
  stepNumber: number;
  originalSelector: string;
  healedSelector?: string;
  confidence?: number;
  status: 'success' | 'failed' | 'suggestion';
  aiProvider: 'claude';
  cost: number;
  timestamp: string;
}
```

---

## 6. Rate Limiting

### 6.1 Multi-Layer Rate Limiting
```typescript
export class RateLimitedHealingService extends AIHealingService {
  private requestCount: number = 0;
  private lastReset: number = Date.now();
  private consecutiveFailures: number = 0;

  async attemptHealing(
    page: Page,
    step: RecordedStep,
    jobId: string
  ): Promise<HealingResult> {
    // Layer 1: Per-minute rate limit
    await this.checkRateLimit();

    // Layer 2: Circuit breaker
    if (this.isCircuitOpen()) {
      return {
        success: false,
        reason: 'Circuit breaker open - too many failures'
      };
    }

    try {
      const result = await super.attemptHealing(page, step, jobId);

      if (result.success) {
        this.consecutiveFailures = 0;
      } else {
        this.consecutiveFailures++;
      }

      return result;

    } catch (error) {
      this.consecutiveFailures++;
      throw error;
    }
  }

  private async checkRateLimit(): Promise<void> {
    const now = Date.now();

    // Reset counter every minute
    if (now - this.lastReset > 60000) {
      this.requestCount = 0;
      this.lastReset = now;
    }

    // Max 50 requests per minute
    if (this.requestCount >= 50) {
      const waitTime = 60000 - (now - this.lastReset);
      await new Promise(r => setTimeout(r, waitTime));
      this.requestCount = 0;
      this.lastReset = Date.now();
    }

    this.requestCount++;
  }

  private isCircuitOpen(): boolean {
    // Open circuit after 3 consecutive failures
    return this.consecutiveFailures >= 3;
  }
}
```

---

## 7. Fallback Strategy

### 7.1 Fallback Chain
```typescript
async executeWithHealing(
  page: Page,
  step: RecordedStep,
  jobId: string
): Promise<ExecutionResult> {
  // Try normal execution first
  try {
    await this.executeStep(page, step);
    return { success: true };

  } catch (error) {
    // All strategies failed - try healing
    if (this.shouldTriggerHealing(error)) {
      const healing = await this.healingService.attemptHealing(
        page,
        step,
        jobId
      );

      if (healing.success) {
        // Retry with healed selector
        const healedStep = {
          ...step,
          bundle: {
            ...step.bundle,
            xpath: healing.selector
          }
        };

        try {
          await this.executeStep(page, healedStep);
          return { success: true, healed: true };

        } catch (retryError) {
          // Healing didn't help
          return { success: false, error: retryError.message };
        }
      }
    }

    // No healing available
    return { success: false, error: error.message };
  }
}
```

### 7.2 API Unavailable Fallback
```typescript
async attemptHealingWithFallback(
  page: Page,
  step: RecordedStep,
  jobId: string
): Promise<HealingResult> {
  try {
    return await this.attemptHealing(page, step, jobId);

  } catch (error) {
    // API unavailable - check cache only
    if (error.message.includes('API') || error.message.includes('timeout')) {
      const cacheKey = this.generateCacheKey(step, page.url());
      const cached = await this.cache.get(cacheKey);

      if (cached && cached.successRate > 0.5) {
        return {
          success: true,
          source: 'cache',
          selector: cached.healedSelector,
          confidence: cached.confidence
        };
      }

      // Log degraded mode
      await this.logger.log(jobId, 'API unavailable, using fallback');
    }

    return { success: false, reason: 'Healing unavailable' };
  }
}
```

---

## 8. Monitoring

### 8.1 Healing Metrics
```typescript
interface HealingMetrics {
  totalAttempts: number;
  successCount: number;
  failureCount: number;
  cacheHits: number;
  cacheMisses: number;
  avgConfidence: number;
  avgLatency: number;
  totalCost: number;
  successRate: number;
}

export class HealingMetricsCollector {
  async collectMetrics(jobId: string): Promise<HealingMetrics> {
    const { data: logs } = await this.supabase
      .from('healing_logs')
      .select('*')
      .eq('job_id', jobId);

    if (!logs || logs.length === 0) {
      return this.emptyMetrics();
    }

    const successLogs = logs.filter(l => l.status === 'success');
    const totalConfidence = successLogs.reduce((sum, l) => sum + l.confidence, 0);

    return {
      totalAttempts: logs.length,
      successCount: successLogs.length,
      failureCount: logs.filter(l => l.status === 'failed').length,
      cacheHits: logs.filter(l => l.source === 'cache').length,
      cacheMisses: logs.filter(l => l.source === 'vision_api').length,
      avgConfidence: successLogs.length > 0 ? totalConfidence / successLogs.length : 0,
      avgLatency: this.calculateAvgLatency(logs),
      totalCost: logs.reduce((sum, l) => sum + l.cost, 0),
      successRate: logs.length > 0 ? successLogs.length / logs.length : 0
    };
  }
}
```

---

## 9. Cost Management

### 9.1 Cost Tracking
```typescript
const CLAUDE_VISION_COST = 0.005; // ~$0.005 per image analysis

export class CostTracker {
  async trackAPICall(
    jobId: string,
    inputTokens: number,
    outputTokens: number
  ): Promise<void> {
    // Calculate actual cost
    const cost = this.calculateCost(inputTokens, outputTokens);

    await this.supabase
      .from('api_costs')
      .insert({
        job_id: jobId,
        service: 'claude_vision',
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost,
        timestamp: new Date().toISOString()
      });
  }

  private calculateCost(inputTokens: number, outputTokens: number): number {
    // Claude Sonnet pricing (approximate)
    const inputCost = (inputTokens / 1000) * 0.003;
    const outputCost = (outputTokens / 1000) * 0.015;
    return inputCost + outputCost;
  }
}
```

### 9.2 Budget Limits
```typescript
interface BudgetConfig {
  maxCostPerJob: number;      // Default: $1.00
  maxCostPerDay: number;      // Default: $10.00
  maxCostPerMonth: number;    // Default: $100.00
}

async checkBudget(jobId: string): Promise<boolean> {
  const dailyCost = await this.getDailyCost();

  if (dailyCost >= this.config.maxCostPerDay) {
    console.warn('Daily budget exceeded, healing disabled');
    return false;
  }

  return true;
}
```

---

## 10. Testing Strategy

### 10.1 Unit Tests
```typescript
describe('AIHealingService', () => {
  it('returns cached result when available', async () => {
    mockCache.get.mockResolvedValue({
      healedSelector: '#cached-btn',
      confidence: 85,
      successRate: 0.9
    });

    const result = await service.attemptHealing(page, step, 'job-123');

    expect(result.success).toBe(true);
    expect(result.source).toBe('cache');
    expect(result.selector).toBe('#cached-btn');
  });

  it('calls Vision API when cache misses', async () => {
    mockCache.get.mockResolvedValue(null);
    mockVisionAPI.analyze.mockResolvedValue({
      found: true,
      confidence: 90,
      boundingBox: { x: 100, y: 200, width: 50, height: 30 }
    });

    await service.attemptHealing(page, step, 'job-123');

    expect(mockVisionAPI.analyze).toHaveBeenCalled();
  });
});
```

### 10.2 Integration Tests
```typescript
describe('Healing Integration', () => {
  it('heals broken selector end-to-end', async () => {
    const page = await browser.newPage();
    await page.setContent(`
      <button id="new-id">Click me</button>
    `);

    const step = {
      event: 'click',
      bundle: { xpath: '//button[@id="old-id"]' },
      label: 'Click button'
    };

    const result = await service.attemptHealing(page, step, 'job-test');

    expect(result.success).toBe(true);
    expect(result.selector).toContain('new-id');
  });
});
```

---

## Summary

AI Healing provides:
- ✅ **Automatic recovery** from element-not-found errors
- ✅ **6-step healing flow** (cache → screenshot → API → convert → evaluate → apply)
- ✅ **Multi-layer rate limiting** with circuit breaker
- ✅ **Confidence-based actions** (auto-apply, flag, suggest)
- ✅ **Aggressive caching** (24-hour TTL, success tracking)
- ✅ **Fallback strategy** when API unavailable
- ✅ **Cost management** with budget limits
- ✅ **Comprehensive monitoring** with metrics
- ✅ **Testing infrastructure** with unit and integration tests

This provides resilient test execution with AI-powered self-healing.
