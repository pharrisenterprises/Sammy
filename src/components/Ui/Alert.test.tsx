/**
 * Alert Component Tests
 * @module components/Ui/Alert.test
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  Alert,
  AlertTitle,
  AlertDescription,
  InlineAlert,
  BannerAlert,
  ToastProvider,
  useToast,
  LogPanel,
  NotificationOverlay,
  LogEntry,
} from './Alert';

// ============================================================================
// ALERT TESTS
// ============================================================================

describe('Alert', () => {
  describe('Rendering', () => {
    it('should render alert with children', () => {
      render(<Alert testId="my-alert">Alert message</Alert>);
      expect(screen.getByTestId('my-alert')).toHaveTextContent('Alert message');
    });

    it('should render with role="alert"', () => {
      render(<Alert testId="my-alert">Message</Alert>);
      expect(screen.getByTestId('my-alert')).toHaveAttribute('role', 'alert');
    });
  });

  describe('Variants', () => {
    const variants = ['default', 'info', 'success', 'warning', 'error'] as const;

    variants.forEach((variant) => {
      it(`should render ${variant} variant`, () => {
        render(<Alert variant={variant} testId={`alert-${variant}`}>Message</Alert>);
        expect(screen.getByTestId(`alert-${variant}`)).toHaveAttribute('data-variant', variant);
      });
    });
  });

  describe('Sizes', () => {
    const sizes = ['sm', 'md', 'lg'] as const;

    sizes.forEach((size) => {
      it(`should render ${size} size`, () => {
        render(<Alert size={size} testId={`alert-${size}`}>Message</Alert>);
        expect(screen.getByTestId(`alert-${size}`)).toBeInTheDocument();
      });
    });
  });

  describe('Icon', () => {
    it('should show default icon', () => {
      render(<Alert showIcon testId="my-alert">Message</Alert>);
      expect(screen.getByTestId('my-alert-icon')).toBeInTheDocument();
    });

    it('should hide icon when showIcon is false', () => {
      render(<Alert showIcon={false} testId="my-alert">Message</Alert>);
      expect(screen.queryByTestId('my-alert-icon')).not.toBeInTheDocument();
    });

    it('should render custom icon', () => {
      render(
        <Alert icon={<span data-testid="custom-icon">🔔</span>} testId="my-alert">
          Message
        </Alert>
      );
      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });
  });

  describe('Dismissible', () => {
    it('should show dismiss button when dismissible', () => {
      render(<Alert dismissible testId="my-alert">Message</Alert>);
      expect(screen.getByTestId('my-alert-dismiss')).toBeInTheDocument();
    });

    it('should hide alert when dismiss clicked', async () => {
      render(<Alert dismissible testId="my-alert">Message</Alert>);
      
      await userEvent.click(screen.getByTestId('my-alert-dismiss'));
      
      expect(screen.queryByTestId('my-alert')).not.toBeInTheDocument();
    });

    it('should call onDismiss when dismissed', async () => {
      const onDismiss = vi.fn();
      render(<Alert dismissible onDismiss={onDismiss} testId="my-alert">Message</Alert>);
      
      await userEvent.click(screen.getByTestId('my-alert-dismiss'));
      
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe('Action', () => {
    it('should render action element', () => {
      render(
        <Alert action={<button data-testid="action-btn">Action</button>} testId="my-alert">
          Message
        </Alert>
      );
      expect(screen.getByTestId('action-btn')).toBeInTheDocument();
    });
  });

  describe('Filled Style', () => {
    it('should render filled style', () => {
      render(<Alert filled variant="success" testId="my-alert">Message</Alert>);
      expect(screen.getByTestId('my-alert')).toHaveClass('bg-green-600');
    });
  });
});

// ============================================================================
// ALERT TITLE TESTS
// ============================================================================

describe('AlertTitle', () => {
  it('should render title', () => {
    render(
      <Alert>
        <AlertTitle testId="title">My Title</AlertTitle>
      </Alert>
    );
    expect(screen.getByTestId('title')).toHaveTextContent('My Title');
  });

  it('should render as heading', () => {
    render(
      <Alert>
        <AlertTitle testId="title">Title</AlertTitle>
      </Alert>
    );
    expect(screen.getByTestId('title').tagName).toBe('H5');
  });
});

// ============================================================================
// ALERT DESCRIPTION TESTS
// ============================================================================

describe('AlertDescription', () => {
  it('should render description', () => {
    render(
      <Alert>
        <AlertDescription testId="desc">Description text</AlertDescription>
      </Alert>
    );
    expect(screen.getByTestId('desc')).toHaveTextContent('Description text');
  });
});

// ============================================================================
// INLINE ALERT TESTS
// ============================================================================

describe('InlineAlert', () => {
  it('should render inline alert', () => {
    render(<InlineAlert message="Inline message" testId="inline" />);
    expect(screen.getByTestId('inline')).toHaveTextContent('Inline message');
  });

  it('should render with variant', () => {
    render(<InlineAlert variant="success" message="Success!" testId="inline" />);
    expect(screen.getByTestId('inline')).toBeInTheDocument();
  });
});

// ============================================================================
// BANNER ALERT TESTS
// ============================================================================

describe('BannerAlert', () => {
  it('should render banner alert', () => {
    render(<BannerAlert message="Banner message" testId="banner" />);
    expect(screen.getByTestId('banner')).toHaveTextContent('Banner message');
  });

  it('should render with title', () => {
    render(<BannerAlert title="Notice" message="Message" testId="banner" />);
    expect(screen.getByText('Notice')).toBeInTheDocument();
  });

  it('should be dismissible', async () => {
    const onDismiss = vi.fn();
    render(
      <BannerAlert
        message="Message"
        dismissible
        onDismiss={onDismiss}
        testId="banner"
      />
    );
    
    await userEvent.click(screen.getByTestId('banner-dismiss'));
    
    expect(screen.queryByTestId('banner')).not.toBeInTheDocument();
    expect(onDismiss).toHaveBeenCalled();
  });

  it('should render action', () => {
    render(
      <BannerAlert
        message="Message"
        action={<button data-testid="action">Learn more</button>}
        testId="banner"
      />
    );
    expect(screen.getByTestId('action')).toBeInTheDocument();
  });
});

// ============================================================================
// TOAST TESTS
// ============================================================================

describe('Toast System', () => {
  // Test component that uses the toast hook
  const TestComponent: React.FC<{ onMount?: (toast: ReturnType<typeof useToast>) => void }> = ({ onMount }) => {
    const toast = useToast();
    React.useEffect(() => {
      onMount?.(toast);
    }, [toast, onMount]);
    return null;
  };

  it('should render toast container', () => {
    render(
      <ToastProvider>
        <div>App</div>
      </ToastProvider>
    );
    expect(screen.getByTestId('toast-container')).toBeInTheDocument();
  });

  it('should add toast', async () => {
    let toastApi: ReturnType<typeof useToast>;
    
    render(
      <ToastProvider>
        <TestComponent onMount={(api) => { toastApi = api; }} />
      </ToastProvider>
    );
    
    act(() => {
      toastApi!.addToast({
        variant: 'success',
        message: 'Test toast message',
      });
    });
    
    await waitFor(() => {
      expect(screen.getByText('Test toast message')).toBeInTheDocument();
    });
  });

  it('should remove toast', async () => {
    let toastApi: ReturnType<typeof useToast>;
    let toastId: string;
    
    render(
      <ToastProvider>
        <TestComponent onMount={(api) => { toastApi = api; }} />
      </ToastProvider>
    );
    
    act(() => {
      toastId = toastApi!.addToast({
        variant: 'info',
        message: 'Removable toast',
        duration: 0, // Don't auto-remove
      });
    });
    
    await waitFor(() => {
      expect(screen.getByText('Removable toast')).toBeInTheDocument();
    });
    
    act(() => {
      toastApi!.removeToast(toastId);
    });
    
    await waitFor(() => {
      expect(screen.queryByText('Removable toast')).not.toBeInTheDocument();
    });
  });

  it('should auto-dismiss after duration', async () => {
    let toastApi: ReturnType<typeof useToast>;
    
    render(
      <ToastProvider defaultDuration={100}>
        <TestComponent onMount={(api) => { toastApi = api; }} />
      </ToastProvider>
    );
    
    await waitFor(() => {
      expect(toastApi).toBeDefined();
    });
    
    act(() => {
      toastApi!.addToast({
        variant: 'info',
        message: 'Auto dismiss toast',
      });
    });
    
    await waitFor(() => {
      expect(screen.getByText('Auto dismiss toast')).toBeInTheDocument();
    });
    
    // Wait for auto-dismiss
    await waitFor(() => {
      expect(screen.queryByText('Auto dismiss toast')).not.toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('should clear all toasts', async () => {
    let toastApi: ReturnType<typeof useToast>;
    
    render(
      <ToastProvider>
        <TestComponent onMount={(api) => { toastApi = api; }} />
      </ToastProvider>
    );
    
    await waitFor(() => {
      expect(toastApi).toBeDefined();
    });
    
    act(() => {
      toastApi!.addToast({ variant: 'info', message: 'Toast 1', duration: 0 });
      toastApi!.addToast({ variant: 'success', message: 'Toast 2', duration: 0 });
    });
    
    await waitFor(() => {
      expect(screen.getByText('Toast 1')).toBeInTheDocument();
      expect(screen.getByText('Toast 2')).toBeInTheDocument();
    });
    
    act(() => {
      toastApi!.clearToasts();
    });
    
    await waitFor(() => {
      expect(screen.queryByText('Toast 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Toast 2')).not.toBeInTheDocument();
    });
  });

  it('should throw error when useToast used outside provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      render(<TestComponent />);
    }).toThrow('useToast must be used within a ToastProvider');
    
    consoleError.mockRestore();
  });
});

// ============================================================================
// LOG PANEL TESTS
// ============================================================================

describe('LogPanel', () => {
  const sampleLogs: LogEntry[] = [
    { timestamp: '10:00:00', level: 'info', message: 'Test started' },
    { timestamp: '10:00:01', level: 'success', message: 'Step 1 passed' },
    { timestamp: '10:00:02', level: 'warning', message: 'Slow response' },
    { timestamp: '10:00:03', level: 'error', message: 'Step 3 failed' },
  ];

  it('should render log panel', () => {
    render(<LogPanel logs={sampleLogs} testId="log-panel" />);
    expect(screen.getByTestId('log-panel')).toBeInTheDocument();
  });

  it('should render log entries', () => {
    render(<LogPanel logs={sampleLogs} testId="log-panel" />);
    
    expect(screen.getByText('Test started')).toBeInTheDocument();
    expect(screen.getByText('Step 1 passed')).toBeInTheDocument();
    expect(screen.getByText('Slow response')).toBeInTheDocument();
    expect(screen.getByText('Step 3 failed')).toBeInTheDocument();
  });

  it('should show timestamps', () => {
    render(<LogPanel logs={sampleLogs} showTimestamps testId="log-panel" />);
    expect(screen.getByText('[10:00:00]')).toBeInTheDocument();
  });

  it('should hide timestamps', () => {
    render(<LogPanel logs={sampleLogs} showTimestamps={false} testId="log-panel" />);
    expect(screen.queryByText('[10:00:00]')).not.toBeInTheDocument();
  });

  it('should render empty state', () => {
    render(<LogPanel logs={[]} testId="log-panel" />);
    expect(screen.getByText('No logs yet')).toBeInTheDocument();
  });

  it('should call onClear', async () => {
    const onClear = vi.fn();
    render(<LogPanel logs={sampleLogs} onClear={onClear} testId="log-panel" />);
    
    const clearButton = screen.getByTestId('log-panel-clear');
    fireEvent.click(clearButton);
    
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('should show clear button only when onClear provided', () => {
    const { rerender } = render(<LogPanel logs={sampleLogs} testId="log-panel" />);
    expect(screen.queryByTestId('log-panel-clear')).not.toBeInTheDocument();
    
    rerender(<LogPanel logs={sampleLogs} onClear={() => {}} testId="log-panel" />);
    expect(screen.getByTestId('log-panel-clear')).toBeInTheDocument();
  });
});

// ============================================================================
// NOTIFICATION OVERLAY TESTS
// ============================================================================

describe('NotificationOverlay', () => {
  it('should render notification overlay', () => {
    render(
      <NotificationOverlay
        label="Clicking button"
        status="loading"
        testId="overlay"
      />
    );
    expect(screen.getByTestId('overlay')).toBeInTheDocument();
  });

  it('should render label', () => {
    render(
      <NotificationOverlay
        label="Step Label"
        status="success"
        testId="overlay"
      />
    );
    expect(screen.getByText('Step Label')).toBeInTheDocument();
  });

  it('should render value', () => {
    render(
      <NotificationOverlay
        label="Label"
        value="test@example.com"
        status="loading"
        testId="overlay"
      />
    );
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('should show loading status', () => {
    render(
      <NotificationOverlay
        label="Label"
        status="loading"
        testId="overlay"
      />
    );
    expect(screen.getByText('Processing...')).toBeInTheDocument();
  });

  it('should show success status', () => {
    render(
      <NotificationOverlay
        label="Label"
        status="success"
        testId="overlay"
      />
    );
    expect(screen.getByText('Success')).toBeInTheDocument();
  });

  it('should show error status', () => {
    render(
      <NotificationOverlay
        label="Label"
        status="error"
        testId="overlay"
      />
    );
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('should hide when not visible', () => {
    render(
      <NotificationOverlay
        label="Label"
        status="loading"
        visible={false}
        testId="overlay"
      />
    );
    expect(screen.queryByTestId('overlay')).not.toBeInTheDocument();
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('Edge Cases', () => {
  it('should forward ref on Alert', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<Alert ref={ref} testId="alert">Content</Alert>);
    expect(ref.current).toBe(screen.getByTestId('alert'));
  });

  it('should handle className prop', () => {
    render(<Alert className="custom-class" testId="alert">Content</Alert>);
    expect(screen.getByTestId('alert')).toHaveClass('custom-class');
  });

  it('should render compound components together', () => {
    render(
      <Alert variant="success" testId="alert">
        <AlertTitle testId="title">Success!</AlertTitle>
        <AlertDescription testId="desc">Your changes have been saved.</AlertDescription>
      </Alert>
    );
    
    expect(screen.getByTestId('alert')).toBeInTheDocument();
    expect(screen.getByTestId('title')).toBeInTheDocument();
    expect(screen.getByTestId('desc')).toBeInTheDocument();
  });
});
