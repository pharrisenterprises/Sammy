# Feedback Components
**Project:** Chrome Extension Test Recorder - UI Components  
**Document Version:** 1.0  
**Last Updated:** November 25, 2025  
**Status:** Complete Technical Specification

## Table of Contents
1. Overview
2. Toast Notifications
3. Alert Component
4. Progress Indicators
5. Loader Component
6. Error Boundaries
7. Empty States
8. Success States
9. Inline Feedback
10. Testing Strategy

---

## 1. Overview

### 1.1 Purpose

Feedback components communicate system status, operation results, and loading states to users through visual indicators and notifications.

### 1.2 File Location
```
src/components/
├── Loader/
│   └── Loader.tsx
└── ui/
    ├── toast.tsx
    ├── alert.tsx
    ├── progress.tsx
    └── sonner.tsx (toast provider)
```

### 1.3 Feedback Types

| Type | Duration | Interaction | Use Case |
|------|----------|-------------|----------|
| Toast | 3-5 seconds | Dismissible | Operation results |
| Alert | Persistent | Optional action | Important notices |
| Progress | Until complete | None | Loading/upload |
| Loader | Until complete | None | Page/data loading |

---

## 2. Toast Notifications

### 2.1 Toast Implementation (Sonner)
```typescript
// src/components/ui/sonner.tsx
import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton:
            'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton:
            'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground'
        }
      }}
      {...props}
    />
  );
};

export { Toaster };
```

### 2.2 Toast Usage
```typescript
import { toast } from 'sonner';

// Success toast
toast.success('Recording saved successfully');

// Error toast
toast.error('Failed to save recording');

// Info toast
toast.info('New version available');

// Warning toast
toast.warning('Unsaved changes will be lost');

// Promise toast (loading → success/error)
toast.promise(saveRecording(), {
  loading: 'Saving recording...',
  success: 'Recording saved!',
  error: 'Failed to save recording'
});

// Custom toast with action
toast('Recording created', {
  description: 'Your new recording is ready',
  action: {
    label: 'Open',
    onClick: () => navigate('/recorder')
  }
});

// Toast with duration
toast.success('Copied to clipboard', {
  duration: 2000
});
```

### 2.3 Toast Provider Setup
```typescript
// src/App.tsx
import { Toaster } from '@/components/ui/sonner';

function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>
  );
}
```

---

## 3. Alert Component

### 3.1 Alert Implementation
```typescript
// src/components/ui/alert.tsx
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const alertVariants = cva(
  'relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground',
  {
    variants: {
      variant: {
        default: 'bg-background text-foreground',
        destructive:
          'border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive',
        success:
          'border-green-500/50 text-green-700 bg-green-50 [&>svg]:text-green-600',
        warning:
          'border-yellow-500/50 text-yellow-700 bg-yellow-50 [&>svg]:text-yellow-600',
        info:
          'border-blue-500/50 text-blue-700 bg-blue-50 [&>svg]:text-blue-600'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
));
Alert.displayName = 'Alert';

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn('mb-1 font-medium leading-none tracking-tight', className)}
    {...props}
  />
));
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('text-sm [&_p]:leading-relaxed', className)}
    {...props}
  />
));
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertTitle, AlertDescription };
```

### 3.2 Alert Usage
```typescript
import { AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

// Error alert
<Alert variant="destructive">
  <AlertCircle className="h-4 w-4" />
  <AlertTitle>Error</AlertTitle>
  <AlertDescription>
    Failed to connect to the server. Please check your connection.
  </AlertDescription>
</Alert>

// Success alert
<Alert variant="success">
  <CheckCircle className="h-4 w-4" />
  <AlertTitle>Success</AlertTitle>
  <AlertDescription>
    Your recording has been saved successfully.
  </AlertDescription>
</Alert>

// Warning alert
<Alert variant="warning">
  <AlertTriangle className="h-4 w-4" />
  <AlertTitle>Warning</AlertTitle>
  <AlertDescription>
    You have unsaved changes that will be lost.
  </AlertDescription>
</Alert>

// Info alert
<Alert variant="info">
  <Info className="h-4 w-4" />
  <AlertTitle>Note</AlertTitle>
  <AlertDescription>
    AI healing is enabled for this recording.
  </AlertDescription>
</Alert>
```

---

## 4. Progress Indicators

### 4.1 Progress Implementation
```typescript
// src/components/ui/progress.tsx
import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import { cn } from '@/lib/utils';

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      'relative h-4 w-full overflow-hidden rounded-full bg-secondary',
      className
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="h-full w-full flex-1 bg-primary transition-all"
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
```

### 4.2 Progress Variants
```typescript
// Determinate progress
<Progress value={65} />

// With label
<div className="space-y-2">
  <div className="flex justify-between text-sm">
    <span>Uploading...</span>
    <span>65%</span>
  </div>
  <Progress value={65} />
</div>

// Indeterminate (animated)
<div className="relative h-4 w-full overflow-hidden rounded-full bg-secondary">
  <div className="h-full w-1/3 bg-primary animate-indeterminate" />
</div>

// CSS for indeterminate:
// @keyframes indeterminate {
//   0% { transform: translateX(-100%); }
//   100% { transform: translateX(100%); }
// }
// .animate-indeterminate {
//   animation: indeterminate 1.5s ease-in-out infinite;
// }
```

### 4.3 Circular Progress
```typescript
interface CircularProgressProps {
  value: number;
  size?: number;
  strokeWidth?: number;
}

function CircularProgress({
  value,
  size = 40,
  strokeWidth = 4
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        fill="none"
        className="text-muted"
      />
      {/* Progress circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="text-primary transition-all duration-300"
      />
    </svg>
  );
}
```

---

## 5. Loader Component

### 5.1 Loader Implementation
```typescript
// src/components/Loader/Loader.tsx
import { cn } from '@/lib/utils';

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Loader({ size = 'md', className }: LoaderProps) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-2',
    lg: 'w-12 h-12 border-3'
  };

  return (
    <div
      className={cn(
        'animate-spin rounded-full border-t-transparent border-primary',
        sizeClasses[size],
        className
      )}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}
```

### 5.2 Page Loader
```typescript
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <Loader size="lg" />
        <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}
```

### 5.3 Button Loading State
```typescript
interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  children: React.ReactNode;
}

function LoadingButton({ isLoading, children, disabled, ...props }: LoadingButtonProps) {
  return (
    <Button disabled={isLoading || disabled} {...props}>
      {isLoading ? (
        <>
          <Loader size="sm" className="mr-2" />
          Loading...
        </>
      ) : (
        children
      )}
    </Button>
  );
}
```

---

## 6. Error Boundaries

### 6.1 Error Boundary Component
```typescript
// src/components/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center max-w-md">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <Button onClick={this.handleReset}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### 6.2 Error Boundary Usage
```typescript
<ErrorBoundary>
  <Dashboard />
</ErrorBoundary>

// With custom fallback
<ErrorBoundary fallback={<div>Custom error UI</div>}>
  <Recorder />
</ErrorBoundary>
```

---

## 7. Empty States

### 7.1 Empty State Component
```typescript
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({
  icon,
  title,
  description,
  action
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {icon && (
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-muted-foreground mb-4 max-w-sm">
          {description}
        </p>
      )}
      {action && (
        <Button onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
```

### 7.2 Empty State Variants
```typescript
// No recordings
<EmptyState
  icon={<FileText className="w-6 h-6 text-muted-foreground" />}
  title="No recordings yet"
  description="Create your first recording to start automating tests"
  action={{
    label: 'Create Recording',
    onClick: () => navigate('/recorder')
  }}
/>

// No search results
<EmptyState
  icon={<Search className="w-6 h-6 text-muted-foreground" />}
  title="No results found"
  description="Try adjusting your search or filter criteria"
/>

// No data
<EmptyState
  icon={<Upload className="w-6 h-6 text-muted-foreground" />}
  title="No data available"
  description="Upload a CSV file to get started"
  action={{
    label: 'Upload CSV',
    onClick: handleUpload
  }}
/>
```

---

## 8. Success States

### 8.1 Success State Component
```typescript
interface SuccessStateProps {
  title: string;
  description?: string;
  actions?: {
    primary?: { label: string; onClick: () => void };
    secondary?: { label: string; onClick: () => void };
  };
}

export function SuccessState({
  title,
  description,
  actions
}: SuccessStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
        <CheckCircle className="w-8 h-8 text-green-600" />
      </div>
      <h3 className="text-xl font-semibold mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-muted-foreground mb-6 max-w-md">
          {description}
        </p>
      )}
      {actions && (
        <div className="flex gap-2">
          {actions.secondary && (
            <Button variant="outline" onClick={actions.secondary.onClick}>
              {actions.secondary.label}
            </Button>
          )}
          {actions.primary && (
            <Button onClick={actions.primary.onClick}>
              {actions.primary.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
```

### 8.2 Success State Usage
```typescript
// Test completed
<SuccessState
  title="Test completed successfully"
  description="All 15 test cases passed without errors"
  actions={{
    primary: { label: 'View Results', onClick: () => navigate('/results') },
    secondary: { label: 'Run Again', onClick: handleRunAgain }
  }}
/>

// Recording saved
<SuccessState
  title="Recording saved"
  description="Your recording has been saved and is ready to use"
  actions={{
    primary: { label: 'View Recording', onClick: () => navigate('/recorder') }
  }}
/>
```

---

## 9. Inline Feedback

### 9.1 Form Field Error
```typescript
interface FieldErrorProps {
  message?: string;
}

function FieldError({ message }: FieldErrorProps) {
  if (!message) return null;

  return (
    <p className="text-sm text-red-600 mt-1">
      {message}
    </p>
  );
}
```

### 9.2 Character Counter
```typescript
interface CharacterCounterProps {
  current: number;
  max: number;
}

function CharacterCounter({ current, max }: CharacterCounterProps) {
  const remaining = max - current;
  const isWarning = remaining <= 20;
  const isError = remaining < 0;

  return (
    <p
      className={cn(
        'text-xs mt-1',
        isError ? 'text-red-600' : isWarning ? 'text-yellow-600' : 'text-muted-foreground'
      )}
    >
      {current}/{max}
    </p>
  );
}
```

### 9.3 Status Indicator
```typescript
interface StatusIndicatorProps {
  status: 'online' | 'offline' | 'busy' | 'away';
  label?: string;
}

function StatusIndicator({ status, label }: StatusIndicatorProps) {
  const colors = {
    online: 'bg-green-500',
    offline: 'bg-gray-400',
    busy: 'bg-red-500',
    away: 'bg-yellow-500'
  };

  return (
    <div className="flex items-center gap-2">
      <span className={cn('w-2 h-2 rounded-full', colors[status])} />
      {label && (
        <span className="text-sm text-muted-foreground">
          {label || status}
        </span>
      )}
    </div>
  );
}
```

---

## 10. Testing Strategy

### 10.1 Component Tests
```typescript
describe('Toast', () => {
  it('displays success message', async () => {
    render(<TestComponent />);

    act(() => {
      toast.success('Operation successful');
    });

    await waitFor(() => {
      expect(screen.getByText('Operation successful')).toBeInTheDocument();
    });
  });
});

describe('Alert', () => {
  it('renders with correct variant', () => {
    render(
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
      </Alert>
    );

    expect(screen.getByRole('alert')).toHaveClass('border-destructive');
  });
});

describe('ErrorBoundary', () => {
  it('catches errors and displays fallback', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });
});

describe('Progress', () => {
  it('displays correct progress value', () => {
    render(<Progress value={75} />);

    const indicator = document.querySelector('[class*="bg-primary"]');
    expect(indicator).toHaveStyle({ transform: 'translateX(-25%)' });
  });
});
```

---

## Summary

Feedback Components provide:
- ✅ **Toast notifications** with Sonner (success, error, promise)
- ✅ **Alert component** with variants (destructive, success, warning, info)
- ✅ **Progress indicators** (linear, circular, indeterminate)
- ✅ **Loader component** with sizes
- ✅ **Error boundaries** with reset capability
- ✅ **Empty states** with icons and actions
- ✅ **Success states** with action buttons
- ✅ **Inline feedback** (field errors, character counter, status)
- ✅ **Accessibility** (ARIA roles, screen reader support)
- ✅ **Testing strategy** for feedback interactions

Provides clear user feedback across all states.
