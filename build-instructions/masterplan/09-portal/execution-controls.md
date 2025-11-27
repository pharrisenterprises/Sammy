# Execution Controls
**Project:** Chrome Extension Test Recorder  
**Document Version:** 1.0  
**Last Updated:** November 25, 2025  
**Status:** Complete Technical Specification

## Table of Contents
1. Overview
2. Control Panel UI
3. Start Button
4. Stop Button
5. Reset Button
6. Pause/Resume (Phase 2)
7. Button States
8. Keyboard Shortcuts
9. Confirmation Dialogs
10. Testing Strategy

---

## 1. Overview

### 1.1 Purpose

Execution Controls provide user interface elements for managing test execution lifecycle: starting, stopping, pausing, resuming, and resetting tests.

### 1.2 Control Actions

| Action | Phase | Description | Shortcut |
|--------|-------|-------------|----------|
| **Start** | 1 | Begin test execution | Ctrl+Enter |
| **Stop** | 1 | Abort execution immediately | Ctrl+. |
| **Reset** | 1 | Clear logs and reset state | Ctrl+R |
| **Pause** | 2 | Pause at current step | Ctrl+P |
| **Resume** | 2 | Continue from paused state | Ctrl+Enter |

### 1.3 State Machine
```
                    Start
        idle ─────────────────→ running
         ↑                         │
         │                         │ Stop
         │                         ↓
         └───────────────────── aborted
         
         
         (Phase 2)
         
                    Start
        idle ─────────────────→ running
         ↑                      ↙  │  ↘
         │             Pause   ↓   │   ↓  Stop
         │                  paused  │  aborted
         │                     ↓    │
         │                 Resume   │
         └─────────────────────────┘
```

---

## 2. Control Panel UI

### 2.1 ExecutionControls Component
```tsx
import { Play, Square, RotateCcw, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ExecutionControlsProps {
  status: ExecutionStatus;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  onPause?: () => void;    // Phase 2
  onResume?: () => void;   // Phase 2
  disabled?: boolean;
}

type ExecutionStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'aborted';

export function ExecutionControls({
  status,
  onStart,
  onStop,
  onReset,
  onPause,
  onResume,
  disabled = false
}: ExecutionControlsProps) {
  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const isIdle = status === 'idle';
  const isComplete = ['completed', 'failed', 'aborted'].includes(status);

  return (
    <div className="flex items-center gap-3">
      {/* Start/Resume Button */}
      {!isRunning && !isPaused && (
        <Button
          onClick={onStart}
          disabled={disabled || !isIdle}
          size="lg"
          className="gap-2"
        >
          <Play className="h-5 w-5" />
          Start Test
        </Button>
      )}

      {/* Resume Button (Phase 2) */}
      {isPaused && onResume && (
        <Button
          onClick={onResume}
          disabled={disabled}
          size="lg"
          className="gap-2"
        >
          <Play className="h-5 w-5" />
          Resume
        </Button>
      )}

      {/* Stop Button */}
      {isRunning && (
        <Button
          onClick={onStop}
          disabled={disabled}
          variant="destructive"
          size="lg"
          className="gap-2"
        >
          <Square className="h-5 w-5" />
          Stop
        </Button>
      )}

      {/* Pause Button (Phase 2) */}
      {isRunning && onPause && (
        <Button
          onClick={onPause}
          disabled={disabled}
          variant="outline"
          size="lg"
          className="gap-2"
        >
          <Pause className="h-5 w-5" />
          Pause
        </Button>
      )}

      {/* Reset Button */}
      {(isComplete || isIdle) && (
        <Button
          onClick={onReset}
          disabled={disabled}
          variant="outline"
          size="lg"
          className="gap-2"
        >
          <RotateCcw className="h-5 w-5" />
          Reset
        </Button>
      )}

      {/* Status Badge */}
      <ExecutionStatusBadge status={status} />
    </div>
  );
}
```

### 2.2 Status Badge
```tsx
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

export function ExecutionStatusBadge({ status }: { status: ExecutionStatus }) {
  const statusConfig = {
    idle: {
      label: 'Ready',
      variant: 'secondary' as const,
      icon: null
    },
    running: {
      label: 'Running',
      variant: 'default' as const,
      icon: <Loader2 className="h-3 w-3 animate-spin" />
    },
    paused: {
      label: 'Paused',
      variant: 'warning' as const,
      icon: null
    },
    completed: {
      label: 'Completed',
      variant: 'success' as const,
      icon: null
    },
    failed: {
      label: 'Failed',
      variant: 'destructive' as const,
      icon: null
    },
    aborted: {
      label: 'Aborted',
      variant: 'secondary' as const,
      icon: null
    }
  };

  const config = statusConfig[status];

  return (
    <Badge variant={config.variant} className="gap-1">
      {config.icon}
      {config.label}
    </Badge>
  );
}
```

---

## 3. Start Button

### 3.1 Start Button Logic
```tsx
export function useStartButton(projectId: string) {
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const handleStart = async () => {
    setIsStarting(true);
    setStartError(null);

    try {
      // Validate project exists
      const project = await getProject(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      // Validate has recorded steps
      if (!project.recorded_steps || project.recorded_steps.length === 0) {
        throw new Error('No recorded steps. Record steps before running.');
      }

      // Validate CSV if required
      if (project.csv_data && project.csv_data.length === 0) {
        throw new Error('CSV data is empty');
      }

      // Validate field mappings if CSV present
      if (project.csv_data && project.parsed_fields) {
        const mappedFields = project.parsed_fields.filter(f => f.mapped);
        if (mappedFields.length === 0) {
          throw new Error('No fields mapped. Map CSV fields before running.');
        }
      }

      // Start execution
      await startExecution(project);

    } catch (error) {
      setStartError(error.message);
    } finally {
      setIsStarting(false);
    }
  };

  return { handleStart, isStarting, startError };
}
```

### 3.2 Pre-Start Validation
```typescript
interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateBeforeStart(project: Project): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check recorded steps
  if (!project.recorded_steps || project.recorded_steps.length === 0) {
    errors.push('No recorded steps');
  }

  // Check target URL
  if (!project.target_url || project.target_url.trim() === '') {
    errors.push('Target URL not set');
  }

  // Check CSV mapping
  if (project.csv_data && project.csv_data.length > 0) {
    if (!project.parsed_fields || project.parsed_fields.length === 0) {
      errors.push('CSV uploaded but no fields mapped');
    } else {
      const mappedCount = project.parsed_fields.filter(f => f.mapped).length;
      if (mappedCount === 0) {
        errors.push('CSV uploaded but no fields mapped');
      } else if (mappedCount < project.parsed_fields.length) {
        warnings.push(`Only ${mappedCount} of ${project.parsed_fields.length} fields mapped`);
      }
    }
  }

  // Check for large CSV
  if (project.csv_data && project.csv_data.length > 100) {
    warnings.push(`Large CSV (${project.csv_data.length} rows) will take significant time`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
```

---

## 4. Stop Button

### 4.1 Stop Button Implementation
```tsx
export function useStopButton() {
  const [isStopping, setIsStopping] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleStop = () => {
    // Show confirmation dialog
    setShowConfirmation(true);
  };

  const confirmStop = async () => {
    setIsStopping(true);
    setShowConfirmation(false);

    try {
      // Set stop flag (checked between steps)
      isRunningRef.current = false;

      // Cancel any pending operations
      await cancelPendingOperations();

      // Log stop event
      addLog('warning', 'Test execution stopped by user');

      // Update state
      setStatus('aborted');

    } catch (error) {
      console.error('Error stopping execution:', error);
    } finally {
      setIsStopping(false);
    }
  };

  return {
    handleStop,
    confirmStop,
    isStopping,
    showConfirmation,
    setShowConfirmation
  };
}
```

### 4.2 Stop Confirmation Dialog
```tsx
export function StopConfirmationDialog({ 
  open, 
  onConfirm, 
  onCancel,
  currentStep,
  totalSteps
}: StopConfirmationDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Stop Test Execution?</AlertDialogTitle>
          <AlertDialogDescription>
            <div className="space-y-4">
              <p>
                This will abort the current test run at step {currentStep + 1} of {totalSteps}.
              </p>
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Warning</AlertTitle>
                <AlertDescription className="space-y-1">
                  <p>• Current progress will be lost</p>
                  <p>• Partial results will be saved</p>
                  <p>• Cannot resume from this point</p>
                </AlertDescription>
              </Alert>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Continue Running</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-red-600 hover:bg-red-700">
            Yes, Stop Test
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

### 4.3 Graceful Shutdown
```typescript
/**
 * Stop execution gracefully
 * 
 * 1. Set stop flag
 * 2. Wait for current step to complete
 * 3. Clean up resources (close tabs)
 * 4. Save partial results
 */
export async function stopExecutionGracefully(): Promise<void> {
  // Set flag (checked between steps)
  isRunningRef.current = false;

  // Wait for current step (max 10s)
  await waitForCurrentStepWithTimeout(10000);

  // Close any open tabs
  if (currentTabId) {
    try {
      await chrome.runtime.sendMessage({
        action: 'closeTab',
        payload: { tabId: currentTabId }
      });
    } catch (error) {
      console.error('Error closing tab:', error);
    }
  }

  // Save partial results
  await saveTestRun({
    status: 'aborted',
    end_time: new Date().toISOString(),
    passed_steps: passedCount,
    failed_steps: failedCount,
    logs: logs.map(l => l.message).join('\n')
  });
}

async function waitForCurrentStepWithTimeout(timeoutMs: number): Promise<void> {
  const startTime = Date.now();
  
  while (currentStepInProgress.current && Date.now() - startTime < timeoutMs) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
```

---

## 5. Reset Button

### 5.1 Reset Implementation
```tsx
export function useResetButton() {
  const handleReset = () => {
    // Reset execution state
    setStatus('idle');
    setProgress(0);
    setCurrentStep(0);
    setCurrentRow(0);
    setPassedCount(0);
    setFailedCount(0);
    setStartTime(null);
    setEndTime(null);

    // Clear logs
    setLogs([]);

    // Reset test steps
    setTestSteps(prev => prev.map(step => ({
      ...step,
      status: 'pending',
      duration: 0,
      error: null
    })));

    // Clear error state
    setError(null);

    // Log reset
    addLog('info', 'Test execution reset');
  };

  return { handleReset };
}
```

---

## 6. Pause/Resume (Phase 2)

### 6.1 Pause Implementation
```tsx
export function usePauseButton() {
  const isPausedRef = useRef(false);

  const handlePause = () => {
    isPausedRef.current = true;
    setStatus('paused');
    addLog('info', 'Test execution paused by user');
  };

  const handleResume = () => {
    isPausedRef.current = false;
    setStatus('running');
    addLog('info', 'Test execution resumed');
    
    // Continue execution from current step
    continueExecution();
  };

  return { handlePause, handleResume, isPausedRef };
}
```

### 6.2 Pause Check in Execution Loop
```typescript
async function executeSteps(steps: TestStep[]) {
  for (let i = currentStep; i < steps.length; i++) {
    // Check for pause
    while (isPausedRef.current) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Check for stop
    if (!isRunningRef.current) {
      break;
    }

    // Execute step
    await executeStep(steps[i]);
  }
}
```

---

## 7. Button States

### 7.1 State-Based Enabling
```tsx
export function getButtonStates(status: ExecutionStatus, hasSteps: boolean) {
  return {
    startEnabled: status === 'idle' && hasSteps,
    stopEnabled: status === 'running',
    pauseEnabled: status === 'running',
    resumeEnabled: status === 'paused',
    resetEnabled: ['completed', 'failed', 'aborted', 'idle'].includes(status)
  };
}
```

### 7.2 Visual States
```tsx
export function ExecutionButton({ 
  action, 
  onClick, 
  disabled, 
  loading 
}: ExecutionButtonProps) {
  const buttonConfig = {
    start: {
      label: 'Start Test',
      icon: Play,
      variant: 'default' as const,
      loadingLabel: 'Starting...'
    },
    stop: {
      label: 'Stop',
      icon: Square,
      variant: 'destructive' as const,
      loadingLabel: 'Stopping...'
    },
    pause: {
      label: 'Pause',
      icon: Pause,
      variant: 'outline' as const,
      loadingLabel: 'Pausing...'
    },
    resume: {
      label: 'Resume',
      icon: Play,
      variant: 'default' as const,
      loadingLabel: 'Resuming...'
    },
    reset: {
      label: 'Reset',
      icon: RotateCcw,
      variant: 'outline' as const,
      loadingLabel: 'Resetting...'
    }
  };

  const config = buttonConfig[action];
  const Icon = config.icon;

  return (
    <Button
      onClick={onClick}
      disabled={disabled || loading}
      variant={config.variant}
      size="lg"
      className="gap-2"
    >
      {loading ? (
        <>
          <Loader2 className="h-5 w-5 animate-spin" />
          {config.loadingLabel}
        </>
      ) : (
        <>
          <Icon className="h-5 w-5" />
          {config.label}
        </>
      )}
    </Button>
  );
}
```

---

## 8. Keyboard Shortcuts

### 8.1 Shortcut Implementation
```tsx
export function useExecutionShortcuts({
  onStart,
  onStop,
  onReset,
  onPause,
  status
}: UseExecutionShortcutsProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Enter: Start/Resume
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        if (status === 'idle') {
          onStart();
        } else if (status === 'paused' && onPause) {
          onPause();
        }
      }

      // Ctrl+.: Stop
      if (e.ctrlKey && e.key === '.') {
        e.preventDefault();
        if (status === 'running') {
          onStop();
        }
      }

      // Ctrl+R: Reset
      if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        if (['completed', 'failed', 'aborted', 'idle'].includes(status)) {
          onReset();
        }
      }

      // Ctrl+P: Pause (Phase 2)
      if (e.ctrlKey && e.key === 'p' && onPause) {
        e.preventDefault();
        if (status === 'running') {
          onPause();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, onStart, onStop, onReset, onPause]);
}
```

### 8.2 Shortcut Help Tooltip
```tsx
export function ShortcutHelp() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm">
          <Keyboard className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-2">
          <h4 className="font-medium">Keyboard Shortcuts</h4>
          <div className="space-y-1 text-sm">
            <ShortcutRow keys={['Ctrl', 'Enter']} action="Start Test" />
            <ShortcutRow keys={['Ctrl', '.']} action="Stop Test" />
            <ShortcutRow keys={['Ctrl', 'R']} action="Reset" />
            <ShortcutRow keys={['Ctrl', 'P']} action="Pause (Phase 2)" />
            <ShortcutRow keys={['Ctrl', 'L']} action="Clear Logs" />
            <ShortcutRow keys={['Ctrl', 'F']} action="Search Logs" />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ShortcutRow({ keys, action }: { keys: string[]; action: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-gray-600">{action}</span>
      <div className="flex items-center gap-1">
        {keys.map((key, i) => (
          <React.Fragment key={i}>
            <kbd className="px-2 py-1 text-xs bg-gray-100 border border-gray-300 rounded">
              {key}
            </kbd>
            {i < keys.length - 1 && <span className="text-gray-400">+</span>}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
```

---

## 9. Confirmation Dialogs

### 9.1 Start Confirmation (with warnings)
```tsx
export function StartConfirmationDialog({ 
  open, 
  onConfirm, 
  onCancel,
  warnings
}: StartConfirmationDialogProps) {
  if (warnings.length === 0) {
    // No warnings, start immediately
    onConfirm();
    return null;
  }

  return (
    <AlertDialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Start Test with Warnings?</AlertDialogTitle>
          <AlertDialogDescription>
            <div className="space-y-4">
              <p>The following warnings were detected:</p>
              <Alert variant="warning">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1">
                    {warnings.map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
              <p className="text-sm text-gray-600">
                You can proceed, but the test may not behave as expected.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Go Back</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Start Anyway
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

---

## 10. Testing Strategy

### 10.1 Unit Tests
```typescript
describe('Execution Controls', () => {
  it('enables start button when idle with steps', () => {
    const states = getButtonStates('idle', true);
    expect(states.startEnabled).toBe(true);
  });

  it('disables start button when running', () => {
    const states = getButtonStates('running', true);
    expect(states.startEnabled).toBe(false);
  });

  it('enables stop button only when running', () => {
    expect(getButtonStates('running', true).stopEnabled).toBe(true);
    expect(getButtonStates('idle', true).stopEnabled).toBe(false);
  });
});
```

### 10.2 Integration Tests
```typescript
describe('Start Button Flow', () => {
  it('validates project before starting', async () => {
    render(<TestRunner projectId="123" />);

    // Mock invalid project (no steps)
    mockGetProject.mockResolvedValue({ recorded_steps: [] });

    fireEvent.click(screen.getByText('Start Test'));

    await waitFor(() => {
      expect(screen.getByText(/No recorded steps/)).toBeInTheDocument();
    });
  });

  it('starts execution when valid', async () => {
    render(<TestRunner projectId="123" />);

    // Mock valid project
    mockGetProject.mockResolvedValue({
      recorded_steps: [{ id: '1', label: 'Test' }],
      target_url: 'https://example.com'
    });

    fireEvent.click(screen.getByText('Start Test'));

    await waitFor(() => {
      expect(screen.getByText('Running')).toBeInTheDocument();
    });
  });
});

describe('Stop Button Flow', () => {
  it('shows confirmation dialog', async () => {
    render(<TestRunner projectId="123" />);

    // Start execution
    fireEvent.click(screen.getByText('Start Test'));

    // Click stop
    fireEvent.click(screen.getByText('Stop'));

    expect(screen.getByText(/Stop Test Execution?/)).toBeInTheDocument();
  });

  it('aborts execution when confirmed', async () => {
    render(<TestRunner projectId="123" />);

    // Start and stop
    fireEvent.click(screen.getByText('Start Test'));
    fireEvent.click(screen.getByText('Stop'));
    fireEvent.click(screen.getByText('Yes, Stop Test'));

    await waitFor(() => {
      expect(screen.getByText('Aborted')).toBeInTheDocument();
    });
  });
});
```

---

## Summary

Execution Controls provide:
- ✅ **Control panel UI** with state-based button visibility
- ✅ **Start button** with pre-start validation (steps, URL, CSV mapping)
- ✅ **Stop button** with confirmation dialog and graceful shutdown
- ✅ **Reset button** to clear state and logs
- ✅ **Pause/Resume** (Phase 2) with execution loop integration
- ✅ **Button states** with enabling logic based on execution status
- ✅ **Keyboard shortcuts** (Ctrl+Enter start, Ctrl+. stop, Ctrl+R reset, Ctrl+P pause)
- ✅ **Confirmation dialogs** for destructive actions with warning display
- ✅ **Visual feedback** (loading states, status badges, icons)
- ✅ **Testing strategy** with unit and integration test coverage

This provides complete user control over test execution with safety checks and visual feedback.
