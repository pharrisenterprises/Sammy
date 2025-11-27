# Confidence Scoring
**Project:** Chrome Extension Test Recorder - VDI Runner  
**Document Version:** 1.0  
**Last Updated:** November 25, 2025  
**Status:** Complete Technical Specification

## Table of Contents
1. Overview
2. Confidence Sources
3. Scoring Algorithm
4. Threshold Actions
5. Confidence Adjustments
6. User Configuration
7. Logging & Reporting
8. A/B Testing
9. Analytics
10. Testing Strategy

---

## 1. Overview

### 1.1 Purpose

Confidence Scoring determines how certain the AI healing system is about a proposed element match, and what action to take based on that certainty level.

### 1.2 Confidence Scale
```
0-100 scale:
  0-39:  Low confidence (suggest only)
 40-59:  Medium-low (suggest, don't apply)
 60-79:  Medium-high (apply + flag for review)
 80-100: High confidence (auto-apply)
```

### 1.3 Design Principles
```
1. SAFETY FIRST
   - Higher threshold for auto-apply
   - Always validate before applying
   - Flag uncertain healings

2. CONFIGURABLE
   - User-adjustable thresholds
   - Per-recording overrides
   - Environment-specific settings

3. TRANSPARENT
   - Log confidence scores
   - Explain scoring factors
   - Track accuracy over time
```

---

## 2. Confidence Sources

### 2.1 AI Model Confidence
```typescript
interface AIConfidence {
  rawScore: number;        // 0-100 from Claude API
  elementMatch: number;    // How well element matches description
  locationMatch: number;   // How close to expected position
  textMatch: number;       // How well text content matches
}
```

### 2.2 Confidence Factors
```typescript
interface ConfidenceFactors {
  // From AI Response
  aiConfidence: number;           // Primary score from Claude

  // Element Matching
  labelSimilarity: number;        // How similar found text to expected label
  typeSimilarity: number;         // button found for button action
  positionProximity: number;      // Distance from expected bounding box

  // Selector Quality
  selectorUniqueness: number;     // Generated selector matches 1 element
  selectorStability: number;      // Selector uses stable attributes

  // Historical
  cacheSuccessRate: number;       // Past success rate if cached
  pagePatternConfidence: number;  // Confidence for this URL pattern
}
```

---

## 3. Scoring Algorithm

### 3.1 Weighted Score Calculation
```typescript
// src/healing/confidence-evaluator.ts
export class ConfidenceEvaluator {
  private weights: ConfidenceWeights = {
    aiConfidence: 0.50,           // 50% weight
    labelSimilarity: 0.15,        // 15% weight
    typeSimilarity: 0.10,         // 10% weight
    positionProximity: 0.10,      // 10% weight
    selectorUniqueness: 0.10,     // 10% weight
    cacheSuccessRate: 0.05        // 5% weight
  };

  calculateConfidence(factors: ConfidenceFactors): number {
    let score = 0;

    // AI confidence (primary factor)
    score += factors.aiConfidence * this.weights.aiConfidence;

    // Label similarity
    score += factors.labelSimilarity * this.weights.labelSimilarity;

    // Type similarity
    score += factors.typeSimilarity * this.weights.typeSimilarity;

    // Position proximity
    score += factors.positionProximity * this.weights.positionProximity;

    // Selector uniqueness
    score += factors.selectorUniqueness * this.weights.selectorUniqueness;

    // Cache success rate (if available)
    if (factors.cacheSuccessRate > 0) {
      score += factors.cacheSuccessRate * this.weights.cacheSuccessRate;
    }

    // Ensure bounds
    return Math.min(100, Math.max(0, Math.round(score)));
  }
}
```

### 3.2 Factor Calculations
```typescript
calculateLabelSimilarity(expected: string, found: string): number {
  if (!expected || !found) return 0;

  // Normalize strings
  const normalizedExpected = expected.toLowerCase().trim();
  const normalizedFound = found.toLowerCase().trim();

  // Exact match
  if (normalizedExpected === normalizedFound) return 100;

  // Substring match
  if (normalizedFound.includes(normalizedExpected) ||
      normalizedExpected.includes(normalizedFound)) {
    return 85;
  }

  // Fuzzy match using Dice coefficient
  const similarity = stringSimilarity.compareTwoStrings(
    normalizedExpected,
    normalizedFound
  );

  return Math.round(similarity * 100);
}

calculateTypeSimilarity(expected: string, found: string): number {
  const typeGroups: Record<string, string[]> = {
    'clickable': ['button', 'a', 'input[type=submit]', 'input[type=button]'],
    'input': ['input', 'textarea'],
    'select': ['select', 'div[role=listbox]'],
    'checkbox': ['input[type=checkbox]'],
    'radio': ['input[type=radio]']
  };

  // Find expected group
  let expectedGroup = '';
  for (const [group, types] of Object.entries(typeGroups)) {
    if (types.some(t => expected.includes(t))) {
      expectedGroup = group;
      break;
    }
  }

  // Check if found type is in same group
  if (expectedGroup && typeGroups[expectedGroup]?.some(t => found.includes(t))) {
    return 100;
  }

  // Exact type match
  if (expected === found) return 100;

  // Partial match
  return 50;
}

calculatePositionProximity(expected: BoundingBox, found: BoundingBox): number {
  if (!expected || !found) return 50; // Default if no position data

  // Calculate center points
  const expectedCenter = {
    x: expected.x + expected.width / 2,
    y: expected.y + expected.height / 2
  };

  const foundCenter = {
    x: found.x + found.width / 2,
    y: found.y + found.height / 2
  };

  // Calculate distance
  const distance = Math.sqrt(
    Math.pow(expectedCenter.x - foundCenter.x, 2) +
    Math.pow(expectedCenter.y - foundCenter.y, 2)
  );

  // Score based on distance (closer = higher score)
  // Within 50px = 100, within 200px = 75, within 500px = 50, beyond = 25
  if (distance < 50) return 100;
  if (distance < 200) return 75;
  if (distance < 500) return 50;
  return 25;
}

async calculateSelectorUniqueness(page: Page, selector: string): Promise<number> {
  try {
    const count = await page.locator(selector).count();

    if (count === 1) return 100;  // Unique
    if (count === 0) return 0;    // Invalid
    if (count <= 3) return 75;    // Few matches
    if (count <= 10) return 50;   // Multiple matches
    return 25;                     // Too many matches

  } catch {
    return 0;
  }
}
```

---

## 4. Threshold Actions

### 4.1 Action Decisions
```typescript
interface ThresholdConfig {
  autoApply: number;           // Default: 80
  applyWithFlag: number;       // Default: 60
  suggestOnly: number;         // Default: 40
}

type HealingAction = 'auto_apply' | 'apply_with_flag' | 'suggest_only' | 'reject';

function decideAction(
  confidence: number,
  config: ThresholdConfig
): HealingAction {
  if (confidence >= config.autoApply) {
    return 'auto_apply';
  }

  if (confidence >= config.applyWithFlag) {
    return 'apply_with_flag';
  }

  if (confidence >= config.suggestOnly) {
    return 'suggest_only';
  }

  return 'reject';
}
```

### 4.2 Action Handler
```typescript
async executeAction(
  action: HealingAction,
  healing: HealingResult,
  step: RecordedStep,
  jobId: string
): Promise<ActionResult> {
  switch (action) {
    case 'auto_apply':
      // Apply immediately without user intervention
      await this.applyHealing(healing, step);
      await this.logHealing(jobId, healing, 'auto_applied');
      return { applied: true, flagged: false };

    case 'apply_with_flag':
      // Apply but flag for user review
      await this.applyHealing(healing, step);
      await this.logHealing(jobId, healing, 'applied_flagged');
      await this.notifyUser(jobId, healing);
      return { applied: true, flagged: true };

    case 'suggest_only':
      // Don't apply, just log suggestion
      await this.logHealing(jobId, healing, 'suggested');
      return { applied: false, flagged: false, suggestion: healing.selector };

    case 'reject':
      // Confidence too low, reject
      await this.logHealing(jobId, healing, 'rejected');
      return { applied: false, flagged: false };
  }
}
```

### 4.3 Notification System
```typescript
async notifyUser(jobId: string, healing: HealingResult): Promise<void> {
  // Create notification record
  await this.supabase
    .from('healing_notifications')
    .insert({
      job_id: jobId,
      step_number: healing.stepNumber,
      old_selector: healing.originalSelector,
      new_selector: healing.selector,
      confidence: healing.confidence,
      status: 'pending_review',
      created_at: new Date().toISOString()
    });

  // Send email notification (if enabled)
  if (this.emailNotificationsEnabled) {
    await this.emailService.send({
      to: this.userEmail,
      subject: 'AI Healing Applied - Review Required',
      body: `
        A healing was applied with ${healing.confidence}% confidence.
        
        Step: ${healing.stepNumber}
        Old selector: ${healing.originalSelector}
        New selector: ${healing.selector}
        
        Please review in the portal.
      `
    });
  }
}
```

---

## 5. Confidence Adjustments

### 5.1 Boosters
```typescript
interface ConfidenceBooster {
  name: string;
  condition: (factors: ConfidenceFactors) => boolean;
  boost: number;
}

const BOOSTERS: ConfidenceBooster[] = [
  {
    name: 'exact_label_match',
    condition: (f) => f.labelSimilarity === 100,
    boost: 5
  },
  {
    name: 'unique_selector',
    condition: (f) => f.selectorUniqueness === 100,
    boost: 5
  },
  {
    name: 'high_cache_success',
    condition: (f) => f.cacheSuccessRate >= 90,
    boost: 10
  },
  {
    name: 'same_position',
    condition: (f) => f.positionProximity === 100,
    boost: 5
  }
];

function applyBoosters(
  baseScore: number,
  factors: ConfidenceFactors
): number {
  let boosted = baseScore;

  for (const booster of BOOSTERS) {
    if (booster.condition(factors)) {
      boosted += booster.boost;
      console.log(`Applied booster: ${booster.name} (+${booster.boost})`);
    }
  }

  return Math.min(100, boosted);
}
```

### 5.2 Penalties
```typescript
interface ConfidencePenalty {
  name: string;
  condition: (factors: ConfidenceFactors) => boolean;
  penalty: number;
}

const PENALTIES: ConfidencePenalty[] = [
  {
    name: 'type_mismatch',
    condition: (f) => f.typeSimilarity < 50,
    penalty: 15
  },
  {
    name: 'far_from_expected',
    condition: (f) => f.positionProximity < 50,
    penalty: 10
  },
  {
    name: 'ambiguous_selector',
    condition: (f) => f.selectorUniqueness < 50,
    penalty: 20
  },
  {
    name: 'poor_cache_history',
    condition: (f) => f.cacheSuccessRate > 0 && f.cacheSuccessRate < 50,
    penalty: 15
  }
];

function applyPenalties(
  baseScore: number,
  factors: ConfidenceFactors
): number {
  let penalized = baseScore;

  for (const penalty of PENALTIES) {
    if (penalty.condition(factors)) {
      penalized -= penalty.penalty;
      console.log(`Applied penalty: ${penalty.name} (-${penalty.penalty})`);
    }
  }

  return Math.max(0, penalized);
}
```

---

## 6. User Configuration

### 6.1 Configuration Interface
```typescript
interface UserHealingConfig {
  // Threshold settings
  thresholds: {
    autoApply: number;       // 60-100, default 80
    applyWithFlag: number;   // 40-80, default 60
    suggestOnly: number;     // 20-60, default 40
  };

  // Notification settings
  notifications: {
    emailOnFlagged: boolean;
    emailOnSuggestion: boolean;
    slackWebhook?: string;
  };

  // Mode settings
  mode: 'conservative' | 'balanced' | 'aggressive';
}

const MODE_PRESETS: Record<string, ThresholdConfig> = {
  conservative: {
    autoApply: 90,
    applyWithFlag: 75,
    suggestOnly: 50
  },
  balanced: {
    autoApply: 80,
    applyWithFlag: 60,
    suggestOnly: 40
  },
  aggressive: {
    autoApply: 70,
    applyWithFlag: 50,
    suggestOnly: 30
  }
};
```

### 6.2 Per-Recording Override
```typescript
interface RecordingHealingConfig {
  recordingId: string;
  healingEnabled: boolean;
  mode?: 'conservative' | 'balanced' | 'aggressive';
  customThresholds?: ThresholdConfig;
}

async getEffectiveConfig(
  recordingId: string,
  userId: string
): Promise<ThresholdConfig> {
  // Check recording-level override
  const recordingConfig = await this.getRecordingConfig(recordingId);

  if (recordingConfig?.customThresholds) {
    return recordingConfig.customThresholds;
  }

  // Check user preference
  const userConfig = await this.getUserConfig(userId);

  if (userConfig?.mode) {
    return MODE_PRESETS[userConfig.mode];
  }

  // Default
  return MODE_PRESETS.balanced;
}
```

---

## 7. Logging & Reporting

### 7.1 Confidence Log Entry
```typescript
interface ConfidenceLogEntry {
  id: string;
  jobId: string;
  stepNumber: number;
  timestamp: string;

  // Scores
  rawAIConfidence: number;
  calculatedConfidence: number;
  finalConfidence: number;

  // Factors
  factors: ConfidenceFactors;
  boostersApplied: string[];
  penaltiesApplied: string[];

  // Decision
  action: HealingAction;
  thresholdUsed: ThresholdConfig;

  // Result
  applied: boolean;
  succeeded?: boolean;
}

async logConfidenceDecision(entry: ConfidenceLogEntry): Promise<void> {
  await this.supabase
    .from('confidence_logs')
    .insert({
      job_id: entry.jobId,
      step_number: entry.stepNumber,
      timestamp: entry.timestamp,
      raw_ai_confidence: entry.rawAIConfidence,
      calculated_confidence: entry.calculatedConfidence,
      final_confidence: entry.finalConfidence,
      factors: entry.factors,
      boosters_applied: entry.boostersApplied,
      penalties_applied: entry.penaltiesApplied,
      action: entry.action,
      threshold_used: entry.thresholdUsed,
      applied: entry.applied,
      succeeded: entry.succeeded
    });
}
```

### 7.2 Confidence Report
```typescript
interface ConfidenceReport {
  period: { start: Date; end: Date };

  // Distribution
  distribution: {
    high: number;      // 80-100
    mediumHigh: number; // 60-79
    mediumLow: number;  // 40-59
    low: number;        // 0-39
  };

  // Actions
  actions: {
    autoApplied: number;
    appliedFlagged: number;
    suggested: number;
    rejected: number;
  };

  // Accuracy
  accuracy: {
    autoApplySuccess: number;    // % of auto-applied that succeeded
    flaggedSuccess: number;      // % of flagged that succeeded
    overallSuccess: number;      // % of all applied that succeeded
  };

  // Recommendations
  recommendations: string[];
}

async generateReport(
  organizationId: string,
  startDate: Date,
  endDate: Date
): Promise<ConfidenceReport> {
  const { data: logs } = await this.supabase
    .from('confidence_logs')
    .select('*')
    .eq('organization_id', organizationId)
    .gte('timestamp', startDate.toISOString())
    .lte('timestamp', endDate.toISOString());

  // Calculate distribution
  const distribution = this.calculateDistribution(logs);

  // Calculate actions
  const actions = this.calculateActions(logs);

  // Calculate accuracy
  const accuracy = this.calculateAccuracy(logs);

  // Generate recommendations
  const recommendations = this.generateRecommendations(distribution, accuracy);

  return {
    period: { start: startDate, end: endDate },
    distribution,
    actions,
    accuracy,
    recommendations
  };
}
```

---

## 8. A/B Testing

### 8.1 Threshold Experiments
```typescript
interface ThresholdExperiment {
  id: string;
  name: string;
  variants: {
    control: ThresholdConfig;
    treatment: ThresholdConfig;
  };
  allocation: number;  // % in treatment (0-100)
  startDate: Date;
  endDate?: Date;
  status: 'active' | 'completed' | 'paused';
}

async getThresholdForJob(
  jobId: string,
  userId: string
): Promise<{ config: ThresholdConfig; variant: string }> {
  // Check active experiments
  const experiment = await this.getActiveExperiment();

  if (!experiment) {
    return {
      config: MODE_PRESETS.balanced,
      variant: 'default'
    };
  }

  // Deterministic assignment based on userId
  const hash = this.hashUserId(userId);
  const bucket = hash % 100;

  if (bucket < experiment.allocation) {
    return {
      config: experiment.variants.treatment,
      variant: 'treatment'
    };
  }

  return {
    config: experiment.variants.control,
    variant: 'control'
  };
}
```

### 8.2 Experiment Analysis
```typescript
async analyzeExperiment(experimentId: string): Promise<ExperimentAnalysis> {
  const { data: controlLogs } = await this.supabase
    .from('confidence_logs')
    .select('*')
    .eq('experiment_id', experimentId)
    .eq('variant', 'control');

  const { data: treatmentLogs } = await this.supabase
    .from('confidence_logs')
    .select('*')
    .eq('experiment_id', experimentId)
    .eq('variant', 'treatment');

  return {
    control: {
      count: controlLogs.length,
      successRate: this.calculateSuccessRate(controlLogs),
      avgConfidence: this.calculateAvgConfidence(controlLogs)
    },
    treatment: {
      count: treatmentLogs.length,
      successRate: this.calculateSuccessRate(treatmentLogs),
      avgConfidence: this.calculateAvgConfidence(treatmentLogs)
    },
    significanceLevel: this.calculateSignificance(controlLogs, treatmentLogs)
  };
}
```

---

## 9. Analytics

### 9.1 Confidence Metrics
```typescript
interface ConfidenceAnalytics {
  // Averages
  avgConfidence: number;
  avgAIConfidence: number;
  avgFinalConfidence: number;

  // Calibration
  calibrationScore: number;  // How well confidence predicts success

  // Trends
  confidenceTrend: 'improving' | 'stable' | 'declining';
  successTrend: 'improving' | 'stable' | 'declining';
}

async getAnalytics(organizationId: string): Promise<ConfidenceAnalytics> {
  const { data: recentLogs } = await this.supabase
    .from('confidence_logs')
    .select('*')
    .eq('organization_id', organizationId)
    .order('timestamp', { ascending: false })
    .limit(1000);

  // Calculate calibration (confidence vs actual success)
  const calibrationScore = this.calculateCalibration(recentLogs);

  // Calculate trends
  const confidenceTrend = this.calculateTrend(
    recentLogs.map(l => l.final_confidence)
  );

  const successTrend = this.calculateTrend(
    recentLogs.filter(l => l.applied).map(l => l.succeeded ? 1 : 0)
  );

  return {
    avgConfidence: this.average(recentLogs.map(l => l.final_confidence)),
    avgAIConfidence: this.average(recentLogs.map(l => l.raw_ai_confidence)),
    avgFinalConfidence: this.average(recentLogs.map(l => l.final_confidence)),
    calibrationScore,
    confidenceTrend,
    successTrend
  };
}
```

### 9.2 Calibration Analysis
```typescript
calculateCalibration(logs: ConfidenceLogEntry[]): number {
  // Group by confidence buckets
  const buckets: Record<string, { predicted: number; actual: number; count: number }> = {
    '90-100': { predicted: 95, actual: 0, count: 0 },
    '80-89': { predicted: 85, actual: 0, count: 0 },
    '70-79': { predicted: 75, actual: 0, count: 0 },
    '60-69': { predicted: 65, actual: 0, count: 0 },
    '50-59': { predicted: 55, actual: 0, count: 0 }
  };

  // Fill buckets
  for (const log of logs.filter(l => l.applied)) {
    const bucket = this.getBucket(log.final_confidence);
    if (bucket && buckets[bucket]) {
      buckets[bucket].count++;
      buckets[bucket].actual += log.succeeded ? 1 : 0;
    }
  }

  // Calculate calibration error
  let totalError = 0;
  let totalWeight = 0;

  for (const bucket of Object.values(buckets)) {
    if (bucket.count > 0) {
      const actualRate = (bucket.actual / bucket.count) * 100;
      const error = Math.abs(bucket.predicted - actualRate);
      totalError += error * bucket.count;
      totalWeight += bucket.count;
    }
  }

  // Return calibration score (100 = perfectly calibrated)
  const avgError = totalWeight > 0 ? totalError / totalWeight : 0;
  return Math.max(0, 100 - avgError);
}
```

---

## 10. Testing Strategy

### 10.1 Unit Tests
```typescript
describe('ConfidenceEvaluator', () => {
  it('calculates weighted score correctly', () => {
    const evaluator = new ConfidenceEvaluator();
    const factors: ConfidenceFactors = {
      aiConfidence: 80,
      labelSimilarity: 100,
      typeSimilarity: 100,
      positionProximity: 75,
      selectorUniqueness: 100,
      cacheSuccessRate: 0
    };

    const score = evaluator.calculateConfidence(factors);

    // Expected: 80*0.5 + 100*0.15 + 100*0.1 + 75*0.1 + 100*0.1 = 82.5
    expect(score).toBeGreaterThanOrEqual(80);
    expect(score).toBeLessThanOrEqual(85);
  });

  it('applies boosters correctly', () => {
    const factors: ConfidenceFactors = {
      aiConfidence: 75,
      labelSimilarity: 100,  // Exact match booster
      selectorUniqueness: 100,  // Unique selector booster
      typeSimilarity: 100,
      positionProximity: 100,  // Same position booster
      cacheSuccessRate: 0
    };

    const baseScore = 75;
    const boosted = applyBoosters(baseScore, factors);

    // Should have +5 +5 +5 = 15 boost
    expect(boosted).toBe(90);
  });

  it('decides action based on thresholds', () => {
    const config: ThresholdConfig = {
      autoApply: 80,
      applyWithFlag: 60,
      suggestOnly: 40
    };

    expect(decideAction(85, config)).toBe('auto_apply');
    expect(decideAction(70, config)).toBe('apply_with_flag');
    expect(decideAction(50, config)).toBe('suggest_only');
    expect(decideAction(30, config)).toBe('reject');
  });
});
```

### 10.2 Integration Tests
```typescript
describe('Confidence Integration', () => {
  it('evaluates healing and decides action', async () => {
    const evaluator = new ConfidenceEvaluator();
    const page = await browser.newPage();
    await page.setContent('<button id="test">Click Me</button>');

    const factors = await evaluator.evaluateHealing(page, {
      aiResult: { found: true, confidence: 85 },
      step: { event: 'click', label: 'Click Me' },
      selector: '#test'
    });

    expect(factors.aiConfidence).toBe(85);
    expect(factors.selectorUniqueness).toBe(100);

    const action = evaluator.decideAction(factors);
    expect(action).toBe('auto_apply');
  });
});
```

---

## Summary

Confidence Scoring provides:
- ✅ **Weighted scoring algorithm** (AI 50%, label 15%, type 10%, position 10%, selector 10%, cache 5%)
- ✅ **Threshold-based actions** (auto-apply ≥80, flag 60-79, suggest 40-59, reject <40)
- ✅ **Boosters and penalties** for score adjustment
- ✅ **User configuration** with mode presets (conservative, balanced, aggressive)
- ✅ **Per-recording overrides** for custom thresholds
- ✅ **Detailed logging** with factor breakdown
- ✅ **Confidence reports** with accuracy tracking
- ✅ **A/B testing** for threshold optimization
- ✅ **Calibration analytics** to validate confidence accuracy
- ✅ **Testing strategy** with unit and integration tests

This ensures intelligent, configurable healing decisions.
