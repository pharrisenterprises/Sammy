# Progress Tracking System
**Project:** Chrome Extension Test Recorder  
**Document Version:** 1.0  
**Last Updated:** November 25, 2025  
**Status:** Complete Technical Specification

## Table of Contents
1. Overview
2. Progress Calculation
3. Progress Bar Component
4. Statistics Cards
5. Time Tracking
6. CSV Row Progress
7. Step Status Indicators
8. Circular Progress
9. Estimation Algorithms
10. Testing Strategy

---

## 1. Overview

### 1.1 Purpose

The Progress Tracking System provides real-time feedback on test execution status through visual indicators, counters, and time estimates.

### 1.2 Key Metrics
```typescript
interface ProgressMetrics {
  // Step Progress
  totalSteps: number;              // Total steps to execute
  completedSteps: number;          // Passed + failed steps
  passedSteps: number;             // Successfully executed
  failedSteps: number;             // Failed steps
  skippedSteps: number;            // Skipped steps
  currentStep: number;             // Currently executing step index
  
  // CSV Progress
  totalRows: number;               // Total CSV rows
  currentRow: number;              // Currently processing row
  
  // Time Metrics
  startTime: number;               // Unix timestamp (ms)
  elapsedTime: number;             // Milliseconds elapsed
  estimatedRemaining: number;      // Estimated ms remaining
  
  // Percentages
  overallProgress: number;         // 0-100%
  rowProgress: number;             // 0-100% for current row
}
```

### 1.3 Visual Hierarchy
```
┌────────────────────────────────────────────────────────┐
│ OVERALL PROGRESS BAR                                   │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░  67%   │
└────────────────────────────────────────────────────────┘
                          ↓
┌─────────────┬─────────────┬─────────────┬─────────────┐
│  Passed     │  Failed     │  Duration   │  Est. Time  │
│    45       │     3       │   2m 15s    │   1m 5s     │
└─────────────┴─────────────┴─────────────┴─────────────┘
                          ↓
┌────────────────────────────────────────────────────────┐
│ ROW PROGRESS                                           │
│ Processing row 7 of 10                                 │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░  70%      │
└────────────────────────────────────────────────────────┘
```

---

## 2. Progress Calculation

### 2.1 Overall Progress Formula
```typescript
/**
 * Calculate overall progress percentage
 * 
 * Formula: (completed_steps / total_steps) × 100
 * 
 * Where:
 *   completed_steps = passed_steps + failed_steps
 *   total_steps = num_steps × num_csv_rows
 */
export function calculateOverallProgress(metrics: ProgressMetrics): number {
  if (metrics.totalSteps === 0) return 0;
  
  const completed = metrics.passedSteps + metrics.failedSteps;
  const progress = (completed / metrics.totalSteps) * 100;
  
  return Math.min(Math.round(progress), 100);
}
```

### 2.2 Row Progress Formula
```typescript
/**
 * Calculate progress for current CSV row
 * 
 * Formula: (completed_steps_in_row / steps_per_row) × 100
 */
export function calculateRowProgress(
  currentStepInRow: number,
  stepsPerRow: number
): number {
  if (stepsPerRow === 0) return 0;
  
  const progress = (currentStepInRow / stepsPerRow) * 100;
  
  return Math.min(Math.round(progress), 100);
}
```

### 2.3 Success Rate Formula
```typescript
/**
 * Calculate success rate (passed / total completed)
 * 
 * Formula: (passed_steps / (passed_steps + failed_steps)) × 100
 */
export function calculateSuccessRate(
  passedSteps: number,
  failedSteps: number
): number {
  const total = passedSteps + failedSteps;
  if (total === 0) return 0;
  
  return Math.round((passedSteps / total) * 100);
}
```

---

## 3. Progress Bar Component

### 3.1 Basic Progress Bar
```tsx
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number;                    // 0-100
  status?: ExecutionStatus;
  showPercentage?: boolean;
  animated?: boolean;
  height?: number;
}

type ExecutionStatus = 'idle' | 'running' | 'completed' | 'failed' | 'paused';

export function ProgressBar({
  value,
  status = 'idle',
  showPercentage = true,
  animated = true,
  height = 8
}: ProgressBarProps) {
  const statusConfig = getStatusConfig(status);

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Overall Progress</span>
        {showPercentage && (
          <span className={cn("font-semibold", statusConfig.textColor)}>
            {value}%
          </span>
        )}
      </div>
      
      <div className="relative">
        <Progress 
          value={value} 
          className={cn("h-2", statusConfig.barColor)}
        />
        {animated && status === 'running' && (
          <div className="absolute inset-0 animate-pulse opacity-50" />
        )}
      </div>
    </div>
  );
}

function getStatusConfig(status: ExecutionStatus) {
  const configs = {
    idle: {
      barColor: 'bg-gray-400',
      textColor: 'text-gray-600'
    },
    running: {
      barColor: 'bg-blue-500',
      textColor: 'text-blue-600'
    },
    completed: {
      barColor: 'bg-green-500',
      textColor: 'text-green-600'
    },
    failed: {
      barColor: 'bg-red-500',
      textColor: 'text-red-600'
    },
    paused: {
      barColor: 'bg-yellow-500',
      textColor: 'text-yellow-600'
    }
  };

  return configs[status];
}
```

### 3.2 Multi-Segment Progress Bar
```tsx
/**
 * Show passed (green), failed (red), remaining (gray)
 */
export function SegmentedProgressBar({ 
  passed, 
  failed, 
  total 
}: { 
  passed: number; 
  failed: number; 
  total: number;
}) {
  const passedPercent = (passed / total) * 100;
  const failedPercent = (failed / total) * 100;
  const remainingPercent = 100 - passedPercent - failedPercent;

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Step Progress</span>
        <span className="text-sm text-gray-600">
          {passed + failed} / {total}
        </span>
      </div>
      
      <div className="flex h-2 w-full rounded-full overflow-hidden">
        {/* Passed segment */}
        <div 
          className="bg-green-500 transition-all duration-300"
          style={{ width: `${passedPercent}%` }}
        />
        
        {/* Failed segment */}
        <div 
          className="bg-red-500 transition-all duration-300"
          style={{ width: `${failedPercent}%` }}
        />
        
        {/* Remaining segment */}
        <div 
          className="bg-gray-200 transition-all duration-300"
          style={{ width: `${remainingPercent}%` }}
        />
      </div>
      
      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          Passed: {passed}
        </div>
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-red-500" />
          Failed: {failed}
        </div>
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-gray-200" />
          Remaining: {total - passed - failed}
        </div>
      </div>
    </div>
  );
}
```

---

## 4. Statistics Cards

### 4.1 Statistic Card Component
```tsx
import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  variant?: 'default' | 'success' | 'error' | 'warning' | 'info';
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
}

export function StatCard({
  label,
  value,
  icon: Icon,
  variant = 'default',
  subtitle,
  trend
}: StatCardProps) {
  const variantConfig = {
    default: {
      bgColor: 'bg-gray-50',
      iconColor: 'text-gray-600',
      textColor: 'text-gray-900'
    },
    success: {
      bgColor: 'bg-green-50',
      iconColor: 'text-green-600',
      textColor: 'text-green-900'
    },
    error: {
      bgColor: 'bg-red-50',
      iconColor: 'text-red-600',
      textColor: 'text-red-900'
    },
    warning: {
      bgColor: 'bg-yellow-50',
      iconColor: 'text-yellow-600',
      textColor: 'text-yellow-900'
    },
    info: {
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600',
      textColor: 'text-blue-900'
    }
  };

  const config = variantConfig[variant];

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-600">{label}</p>
            <p className={cn("text-3xl font-bold", config.textColor)}>
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-gray-500">{subtitle}</p>
            )}
          </div>
          
          <div className={cn("p-3 rounded-full", config.bgColor)}>
            <Icon className={cn("h-6 w-6", config.iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

### 4.2 Statistics Grid
```tsx
import { CheckCircle, XCircle, Clock, Zap } from 'lucide-react';

export function ExecutionStatistics({ metrics }: { metrics: ProgressMetrics }) {
  const duration = formatDuration(metrics.elapsedTime);
  const remaining = formatDuration(metrics.estimatedRemaining);
  const successRate = calculateSuccessRate(metrics.passedSteps, metrics.failedSteps);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="Passed Steps"
        value={metrics.passedSteps}
        icon={CheckCircle}
        variant="success"
        subtitle={`${successRate}% success rate`}
      />
      
      <StatCard
        label="Failed Steps"
        value={metrics.failedSteps}
        icon={XCircle}
        variant="error"
        subtitle={metrics.failedSteps > 0 ? 'Review errors' : 'No failures'}
      />
      
      <StatCard
        label="Duration"
        value={duration}
        icon={Clock}
        variant="info"
        subtitle="Elapsed time"
      />
      
      <StatCard
        label="Est. Remaining"
        value={remaining}
        icon={Zap}
        variant="warning"
        subtitle="Time left"
      />
    </div>
  );
}
```

---

## 5. Time Tracking

### 5.1 Time Formatting
```typescript
/**
 * Format milliseconds into human-readable duration
 * 
 * Examples:
 *   1500     → "1.5s"
 *   65000    → "1m 5s"
 *   3665000  → "1h 1m 5s"
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    const remainingSeconds = seconds % 60;
    return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
  } else if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Format milliseconds into compact duration
 * 
 * Examples:
 *   1500     → "1.5s"
 *   65000    → "1:05"
 *   3665000  → "1:01:05"
 */
export function formatDurationCompact(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  const sec = String(seconds % 60).padStart(2, '0');
  const min = String(minutes % 60).padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${min}:${sec}`;
  } else {
    return `${minutes}:${sec}`;
  }
}
```

### 5.2 Live Timer Component
```tsx
export function LiveTimer({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <div className="flex items-center gap-2 text-sm">
      <Clock className="h-4 w-4 text-gray-500" />
      <span className="font-mono font-medium">
        {formatDuration(elapsed)}
      </span>
    </div>
  );
}
```

---

## 6. CSV Row Progress

### 6.1 Row Progress Component
```tsx
export function CSVRowProgress({ 
  currentRow, 
  totalRows,
  rowProgress 
}: { 
  currentRow: number; 
  totalRows: number;
  rowProgress: number;
}) {
  if (totalRows === 0) return null;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">
                CSV Row Progress
              </p>
              <p className="text-xs text-gray-500">
                Row {currentRow} of {totalRows}
              </p>
            </div>
            <CircularProgress value={rowProgress} size={60} strokeWidth={6} />
          </div>
          
          <Progress value={(currentRow / totalRows) * 100} className="h-2" />
          
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>{totalRows - currentRow} rows remaining</span>
            <span>{Math.round((currentRow / totalRows) * 100)}% complete</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

### 6.2 Row Status List
```tsx
interface RowStatus {
  rowIndex: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  passedSteps: number;
  failedSteps: number;
  duration: number;
}

export function RowStatusList({ rows }: { rows: RowStatus[] }) {
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div
          key={row.rowIndex}
          className={cn(
            "flex items-center justify-between p-3 rounded-lg border",
            row.status === 'completed' && "border-green-200 bg-green-50",
            row.status === 'failed' && "border-red-200 bg-red-50",
            row.status === 'running' && "border-blue-200 bg-blue-50",
            row.status === 'pending' && "border-gray-200 bg-gray-50"
          )}
        >
          <span className="font-medium text-sm">
            <StatusIcon status={row.status} />
            Row {row.rowIndex + 1}
          </span>
          
          <div className="flex items-center gap-3 text-xs">
            <span className="text-green-600">
              ✓ {row.passedSteps}
            </span>
            <span className="text-red-600">
              ✗ {row.failedSteps}
            </span>
            <span className="text-gray-500">
              {formatDuration(row.duration)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## 7. Step Status Indicators

### 7.1 Step Status Icon
```tsx
import { CheckCircle, XCircle, Circle, Loader2 } from 'lucide-react';

interface StepStatusIconProps {
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  size?: number;
}

export function StepStatusIcon({ status, size = 20 }: StepStatusIconProps) {
  const icons = {
    pending: <Circle className="text-gray-300" size={size} />,
    running: <Loader2 className="text-blue-500 animate-spin" size={size} />,
    passed: <CheckCircle className="text-green-500" size={size} />,
    failed: <XCircle className="text-red-500" size={size} />,
    skipped: <Circle className="text-yellow-500" size={size} />
  };

  return icons[status];
}
```

### 7.2 Step List with Progress
```tsx
interface TestStep {
  id: string;
  label: string;
  status: StepStatus;
  duration?: number;
  error?: string;
}

export function StepProgressList({ steps, currentStep }: { steps: TestStep[]; currentStep: number }) {
  return (
    <div className="space-y-1">
      {steps.map((step, index) => (
        <div
          key={step.id}
          className={cn(
            "flex items-center gap-3 p-2 rounded transition-colors",
            index === currentStep && "bg-blue-50 border-l-4 border-l-blue-500",
            step.status === 'passed' && "bg-green-50/50",
            step.status === 'failed' && "bg-red-50/50"
          )}
        >
          <StepStatusIcon status={step.status} />
          
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{step.label}</p>
            {step.error && (
              <p className="text-xs text-red-600 truncate">{step.error}</p>
            )}
          </div>
          
          {step.duration && (
            <span className="text-xs text-gray-500">
              {formatDuration(step.duration)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
```

---

## 8. Circular Progress

### 8.1 Circular Progress Component
```tsx
export function CircularProgress({ 
  value, 
  size = 120, 
  strokeWidth = 8 
}: { 
  value: number; 
  size?: number; 
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-300"
        />
      </svg>
      
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold">{value}%</span>
        <span className="text-xs text-gray-500">Complete</span>
      </div>
    </div>
  );
}
```

---

## 9. Estimation Algorithms

### 9.1 Linear Estimation
```typescript
/**
 * Estimate remaining time using linear extrapolation
 * 
 * Formula: remaining_time = (elapsed_time / completed_steps) × remaining_steps
 */
export function estimateRemainingTimeLinear(
  elapsedTime: number,
  completedSteps: number,
  totalSteps: number
): number {
  if (completedSteps === 0) return 0;
  
  const avgTimePerStep = elapsedTime / completedSteps;
  const remainingSteps = totalSteps - completedSteps;
  
  return Math.round(avgTimePerStep * remainingSteps);
}
```

### 9.2 Exponential Moving Average
```typescript
/**
 * Estimate using exponential moving average (more accurate)
 * 
 * Gives more weight to recent steps
 */
export class TimeEstimator {
  private stepDurations: number[] = [];
  private alpha = 0.3; // Smoothing factor (0-1)

  addStepDuration(duration: number) {
    this.stepDurations.push(duration);
  }

  estimateRemaining(remainingSteps: number): number {
    if (this.stepDurations.length === 0) return 0;

    // Calculate EMA
    let ema = this.stepDurations[0];
    for (let i = 1; i < this.stepDurations.length; i++) {
      ema = this.alpha * this.stepDurations[i] + (1 - this.alpha) * ema;
    }

    return Math.round(ema * remainingSteps);
  }

  reset() {
    this.stepDurations = [];
  }
}
```

### 9.3 Adaptive Estimation
```typescript
/**
 * Adaptive estimation that accounts for CSV row overhead
 */
export function estimateRemainingTimeAdaptive(
  elapsedTime: number,
  completedSteps: number,
  totalSteps: number,
  completedRows: number,
  totalRows: number,
  rowOverheadMs: number = 2000 // Tab open/close overhead
): number {
  if (completedSteps === 0) return 0;

  const avgTimePerStep = elapsedTime / completedSteps;
  const remainingSteps = totalSteps - completedSteps;
  const remainingRows = totalRows - completedRows;

  // Base time + row overhead
  const baseTime = avgTimePerStep * remainingSteps;
  const overheadTime = remainingRows * rowOverheadMs;

  return Math.round(baseTime + overheadTime);
}
```

---

## 10. Testing Strategy

### 10.1 Unit Tests
```typescript
describe('Progress Calculation', () => {
  it('calculates overall progress correctly', () => {
    const metrics: ProgressMetrics = {
      totalSteps: 100,
      passedSteps: 40,
      failedSteps: 10,
      // ...
    };

    const progress = calculateOverallProgress(metrics);
    expect(progress).toBe(50); // (40 + 10) / 100 = 50%
  });

  it('handles zero steps gracefully', () => {
    const metrics: ProgressMetrics = {
      totalSteps: 0,
      passedSteps: 0,
      failedSteps: 0,
      // ...
    };

    const progress = calculateOverallProgress(metrics);
    expect(progress).toBe(0);
  });
});

describe('Time Estimation', () => {
  it('estimates remaining time linearly', () => {
    const elapsed = 60000; // 1 minute
    const completed = 30;
    const total = 100;

    const remaining = estimateRemainingTimeLinear(elapsed, completed, total);
    expect(remaining).toBe(140000); // ~2.3 minutes
  });
});
```

### 10.2 Integration Tests
```typescript
describe('Progress Bar', () => {
  it('updates progress bar as steps complete', async () => {
    render(<TestExecutionPage />);

    fireEvent.click(screen.getByText('Start Test'));

    await waitFor(() => {
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '50');
    });
  });
});
```

---

## Summary

The Progress Tracking System provides:
- ✅ **Overall progress** calculation (completed / total × 100)
- ✅ **Progress bar** with color-coded status (idle, running, completed, failed)
- ✅ **Segmented progress bar** showing passed/failed/remaining
- ✅ **Statistics cards** for passed, failed, duration, estimated time
- ✅ **Time formatting** (ms, seconds, minutes, hours)
- ✅ **Live timer** updated every second
- ✅ **CSV row progress** with per-row status tracking
- ✅ **Step status indicators** (pending, running, passed, failed, skipped)
- ✅ **Circular progress** alternative visualization
- ✅ **3 estimation algorithms** (linear, EMA, adaptive with row overhead)

This provides comprehensive real-time visibility into test execution progress with accurate time estimates.
