/**
 * Alert - Notification/feedback component
 * @module components/Ui/Alert
 * @version 1.0.0
 * 
 * Provides alert components with multiple features:
 * - Variants: info, success, warning, error
 * - Dismissible alerts
 * - Icons and actions
 * - Toast notifications
 * 
 * @example
 * ```tsx
 * <Alert variant="success">
 *   <AlertTitle>Success!</AlertTitle>
 *   <AlertDescription>Your changes have been saved.</AlertDescription>
 * </Alert>
 * ```
 */

import React, {
  forwardRef,
  memo,
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
} from 'react';
import { createPortal } from 'react-dom';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Alert variant
 */
export type AlertVariant = 'info' | 'success' | 'warning' | 'error' | 'default';

/**
 * Alert size
 */
export type AlertSize = 'sm' | 'md' | 'lg';

/**
 * Alert props
 */
export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Visual variant */
  variant?: AlertVariant;
  /** Size */
  size?: AlertSize;
  /** Show icon */
  showIcon?: boolean;
  /** Custom icon */
  icon?: React.ReactNode;
  /** Dismissible */
  dismissible?: boolean;
  /** Dismiss handler */
  onDismiss?: () => void;
  /** Action element */
  action?: React.ReactNode;
  /** Bordered style */
  bordered?: boolean;
  /** Filled style (solid background) */
  filled?: boolean;
  /** Test ID */
  testId?: string;
}

/**
 * Alert title props
 */
export interface AlertTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  /** Test ID */
  testId?: string;
}

/**
 * Alert description props
 */
export interface AlertDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  /** Test ID */
  testId?: string;
}

/**
 * Toast notification
 */
export interface Toast {
  id: string;
  variant: AlertVariant;
  title?: string;
  message: string;
  duration?: number;
  dismissible?: boolean;
  action?: React.ReactNode;
}

/**
 * Toast context
 */
export interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

/**
 * Log entry
 */
export interface LogEntry {
  id?: string;
  timestamp: string;
  level: 'info' | 'success' | 'error' | 'warning';
  message: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Variant styles (light background)
 */
const VARIANT_STYLES: Record<AlertVariant, { bg: string; border: string; text: string; icon: string }> = {
  default: {
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    text: 'text-gray-800',
    icon: 'text-gray-500',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-800',
    icon: 'text-blue-500',
  },
  success: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-800',
    icon: 'text-green-500',
  },
  warning: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    text: 'text-yellow-800',
    icon: 'text-yellow-500',
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-800',
    icon: 'text-red-500',
  },
};

/**
 * Filled variant styles (solid background)
 */
const FILLED_STYLES: Record<AlertVariant, { bg: string; text: string; icon: string }> = {
  default: {
    bg: 'bg-gray-600',
    text: 'text-white',
    icon: 'text-gray-200',
  },
  info: {
    bg: 'bg-blue-600',
    text: 'text-white',
    icon: 'text-blue-200',
  },
  success: {
    bg: 'bg-green-600',
    text: 'text-white',
    icon: 'text-green-200',
  },
  warning: {
    bg: 'bg-yellow-500',
    text: 'text-white',
    icon: 'text-yellow-100',
  },
  error: {
    bg: 'bg-red-600',
    text: 'text-white',
    icon: 'text-red-200',
  },
};

/**
 * Size styles
 */
const SIZE_STYLES: Record<AlertSize, { padding: string; text: string; icon: string }> = {
  sm: {
    padding: 'px-3 py-2',
    text: 'text-sm',
    icon: 'w-4 h-4',
  },
  md: {
    padding: 'px-4 py-3',
    text: 'text-sm',
    icon: 'w-5 h-5',
  },
  lg: {
    padding: 'px-5 py-4',
    text: 'text-base',
    icon: 'w-6 h-6',
  },
};

// ============================================================================
// CONTEXT
// ============================================================================

interface AlertContextValue {
  variant: AlertVariant;
  size: AlertSize;
  filled: boolean;
}

const AlertContext = createContext<AlertContextValue>({
  variant: 'default',
  size: 'md',
  filled: false,
});

const useAlertContext = () => useContext(AlertContext);

// Toast context
const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// ============================================================================
// MAIN ALERT COMPONENT
// ============================================================================

/**
 * Alert component
 */
export const Alert = forwardRef<HTMLDivElement, AlertProps>(({
  variant = 'default',
  size = 'md',
  showIcon = true,
  icon,
  dismissible = false,
  onDismiss,
  action,
  bordered = true,
  filled = false,
  className = '',
  children,
  testId = 'alert',
  role = 'alert',
  ...props
}, ref) => {
  const [isVisible, setIsVisible] = useState(true);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    onDismiss?.();
  }, [onDismiss]);

  if (!isVisible) return null;

  const styles = filled ? FILLED_STYLES[variant] : VARIANT_STYLES[variant];
  const sizeStyles = SIZE_STYLES[size];

  const contextValue: AlertContextValue = {
    variant,
    size,
    filled,
  };

  // Default icon based on variant
  const defaultIcon = !icon && showIcon ? (
    <DefaultIcon variant={variant} className={`${sizeStyles.icon} ${styles.icon} flex-shrink-0`} />
  ) : null;

  return (
    <AlertContext.Provider value={contextValue}>
      <div
        ref={ref}
        role={role}
        className={`
          rounded-lg
          ${sizeStyles.padding}
          ${filled ? styles.bg : styles.bg}
          ${filled ? '' : bordered ? `border ${styles.border}` : ''}
          ${styles.text}
          ${className}
        `}
        data-testid={testId}
        data-variant={variant}
        {...props}
      >
        <div className="flex items-start gap-3">
          {/* Icon */}
          {(icon || defaultIcon) && (
            <div className={`flex-shrink-0 ${styles.icon}`} data-testid={`${testId}-icon`}>
              {icon || defaultIcon}
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            {children}
          </div>

          {/* Action */}
          {action && (
            <div className="flex-shrink-0" data-testid={`${testId}-action`}>
              {action}
            </div>
          )}

          {/* Dismiss button */}
          {dismissible && (
            <button
              type="button"
              onClick={handleDismiss}
              className={`
                flex-shrink-0 p-1 rounded-md
                hover:bg-black/10 transition-colors
                focus:outline-none focus:ring-2 focus:ring-offset-1
                ${filled ? 'focus:ring-white/50' : `focus:ring-${variant === 'default' ? 'gray' : variant}-500`}
              `}
              aria-label="Dismiss alert"
              data-testid={`${testId}-dismiss`}
            >
              <CloseIcon className={`${sizeStyles.icon} ${styles.icon}`} />
            </button>
          )}
        </div>
      </div>
    </AlertContext.Provider>
  );
});

Alert.displayName = 'Alert';

// ============================================================================
// ALERT TITLE COMPONENT
// ============================================================================

/**
 * Alert title
 */
export const AlertTitle = forwardRef<HTMLHeadingElement, AlertTitleProps>(({
  className = '',
  children,
  testId = 'alert-title',
  ...props
}, ref) => {
  const { size } = useAlertContext();

  return (
    <h5
      ref={ref}
      className={`font-semibold leading-tight ${SIZE_STYLES[size].text} ${className}`}
      data-testid={testId}
      {...props}
    >
      {children}
    </h5>
  );
});

AlertTitle.displayName = 'AlertTitle';

// ============================================================================
// ALERT DESCRIPTION COMPONENT
// ============================================================================

/**
 * Alert description
 */
export const AlertDescription = forwardRef<HTMLParagraphElement, AlertDescriptionProps>(({
  className = '',
  children,
  testId = 'alert-description',
  ...props
}, ref) => {
  const { size, filled } = useAlertContext();

  return (
    <p
      ref={ref}
      className={`
        mt-1 leading-relaxed
        ${SIZE_STYLES[size].text}
        ${filled ? 'opacity-90' : 'opacity-80'}
        ${className}
      `}
      data-testid={testId}
      {...props}
    >
      {children}
    </p>
  );
});

AlertDescription.displayName = 'AlertDescription';

// ============================================================================
// INLINE ALERT COMPONENT
// ============================================================================

/**
 * Inline alert props
 */
export interface InlineAlertProps {
  variant?: AlertVariant;
  message: string;
  className?: string;
  testId?: string;
}

/**
 * Simple inline alert (single line)
 */
export const InlineAlert = memo<InlineAlertProps>(({
  variant = 'info',
  message,
  className = '',
  testId = 'inline-alert',
}) => {
  const styles = VARIANT_STYLES[variant];

  return (
    <div
      className={`
        inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm
        ${styles.bg} ${styles.text}
        ${className}
      `}
      role="alert"
      data-testid={testId}
    >
      <DefaultIcon variant={variant} className={`w-4 h-4 ${styles.icon}`} />
      <span>{message}</span>
    </div>
  );
});

InlineAlert.displayName = 'InlineAlert';

// ============================================================================
// BANNER ALERT COMPONENT
// ============================================================================

/**
 * Banner alert props
 */
export interface BannerAlertProps {
  variant?: AlertVariant;
  title?: string;
  message: string;
  dismissible?: boolean;
  onDismiss?: () => void;
  action?: React.ReactNode;
  className?: string;
  testId?: string;
}

/**
 * Full-width banner alert
 */
export const BannerAlert = memo<BannerAlertProps>(({
  variant = 'info',
  title,
  message,
  dismissible = false,
  onDismiss,
  action,
  className = '',
  testId = 'banner-alert',
}) => {
  const [isVisible, setIsVisible] = useState(true);

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  if (!isVisible) return null;

  const styles = FILLED_STYLES[variant];

  return (
    <div
      className={`
        w-full px-4 py-3
        ${styles.bg} ${styles.text}
        ${className}
      `}
      role="alert"
      data-testid={testId}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <DefaultIcon variant={variant} className={`w-5 h-5 ${styles.icon}`} />
          <div>
            {title && <span className="font-semibold mr-2">{title}</span>}
            <span className="opacity-90">{message}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {action}
          {dismissible && (
            <button
              type="button"
              onClick={handleDismiss}
              className="p-1 rounded hover:bg-white/20 transition-colors"
              aria-label="Dismiss banner"
              data-testid={`${testId}-dismiss`}
            >
              <CloseIcon className={`w-5 h-5 ${styles.icon}`} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

BannerAlert.displayName = 'BannerAlert';

// ============================================================================
// TOAST PROVIDER COMPONENT
// ============================================================================

/**
 * Toast provider props
 */
export interface ToastProviderProps {
  children: React.ReactNode;
  /** Position for toasts */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  /** Maximum number of visible toasts */
  maxToasts?: number;
  /** Default duration in ms */
  defaultDuration?: number;
}

/**
 * Toast provider for managing toast notifications
 */
export const ToastProvider: React.FC<ToastProviderProps> = ({
  children,
  position = 'top-right',
  maxToasts = 5,
  defaultDuration = 5000,
}) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast: Toast = {
      ...toast,
      id,
      duration: toast.duration ?? defaultDuration,
      dismissible: toast.dismissible ?? true,
    };

    setToasts((prev) => {
      const updated = [...prev, newToast];
      // Remove oldest if exceeding max
      if (updated.length > maxToasts) {
        return updated.slice(-maxToasts);
      }
      return updated;
    });

    return id;
  }, [defaultDuration, maxToasts]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const contextValue: ToastContextValue = {
    toasts,
    addToast,
    removeToast,
    clearToasts,
  };

  const positionStyles: Record<string, string> = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <div
            className={`fixed z-50 flex flex-col gap-2 ${positionStyles[position]}`}
            data-testid="toast-container"
          >
            {toasts.map((toast) => (
              <ToastItem
                key={toast.id}
                toast={toast}
                onDismiss={() => removeToast(toast.id)}
              />
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
};

// ============================================================================
// TOAST ITEM COMPONENT
// ============================================================================

interface ToastItemProps {
  toast: Toast;
  onDismiss: () => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(onDismiss, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.duration, onDismiss]);

  const styles = VARIANT_STYLES[toast.variant];

  return (
    <div
      className={`
        min-w-[300px] max-w-md p-4 rounded-lg shadow-lg
        border ${styles.border} ${styles.bg}
        animate-slide-in
      `}
      role="alert"
      data-testid={`toast-${toast.id}`}
    >
      <div className="flex items-start gap-3">
        <DefaultIcon variant={toast.variant} className={`w-5 h-5 ${styles.icon} flex-shrink-0`} />
        
        <div className="flex-1 min-w-0">
          {toast.title && (
            <p className={`font-semibold ${styles.text}`}>{toast.title}</p>
          )}
          <p className={`text-sm ${styles.text} ${toast.title ? 'mt-1 opacity-80' : ''}`}>
            {toast.message}
          </p>
          {toast.action && (
            <div className="mt-2">{toast.action}</div>
          )}
        </div>

        {toast.dismissible && (
          <button
            type="button"
            onClick={onDismiss}
            className={`flex-shrink-0 p-1 rounded hover:bg-black/10 ${styles.icon}`}
            aria-label="Dismiss"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// LOG PANEL COMPONENT
// ============================================================================

/**
 * Log panel props
 */
export interface LogPanelProps {
  /** Log entries */
  logs: LogEntry[];
  /** Maximum height */
  maxHeight?: number | string;
  /** Auto scroll to bottom */
  autoScroll?: boolean;
  /** Show timestamps */
  showTimestamps?: boolean;
  /** Clear handler */
  onClear?: () => void;
  /** Additional classes */
  className?: string;
  /** Test ID */
  testId?: string;
}

/**
 * Log panel for displaying execution logs
 */
export const LogPanel = memo<LogPanelProps>(({
  logs,
  maxHeight = 400,
  autoScroll = true,
  showTimestamps = true,
  onClear,
  className = '',
  testId = 'log-panel',
}) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const getLevelStyles = (level: LogEntry['level']) => {
    const styles: Record<string, string> = {
      info: 'text-blue-600',
      success: 'text-green-600',
      warning: 'text-yellow-600',
      error: 'text-red-600',
    };
    return styles[level] || styles.info;
  };

  const getLevelIcon = (level: LogEntry['level']) => {
    const icons: Record<string, string> = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌',
    };
    return icons[level] || icons.info;
  };

  return (
    <div
      className={`bg-gray-900 rounded-lg overflow-hidden ${className}`}
      data-testid={testId}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700">
        <span className="text-sm font-medium text-gray-300">Console</span>
        {onClear && (
          <button
            onClick={onClear}
            className="text-xs text-gray-400 hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-700"
            data-testid={`${testId}-clear`}
          >
            Clear
          </button>
        )}
      </div>

      {/* Log entries */}
      <div
        ref={scrollRef}
        className="overflow-y-auto font-mono text-sm"
        style={{ maxHeight }}
        data-testid={`${testId}-content`}
      >
        {logs.length === 0 ? (
          <div className="px-3 py-4 text-gray-500 text-center">
            No logs yet
          </div>
        ) : (
          logs.map((log, index) => (
            <div
              key={log.id || index}
              className={`
                px-3 py-1.5 border-b border-gray-800 last:border-0
                hover:bg-gray-800/50
                ${getLevelStyles(log.level)}
              `}
              data-testid={`${testId}-entry-${index}`}
            >
              <span className="mr-2">{getLevelIcon(log.level)}</span>
              {showTimestamps && (
                <span className="text-gray-500 mr-2">[{log.timestamp}]</span>
              )}
              <span>{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
});

LogPanel.displayName = 'LogPanel';

// ============================================================================
// NOTIFICATION OVERLAY COMPONENT
// ============================================================================

/**
 * Notification overlay props
 */
export interface NotificationOverlayProps {
  /** Label/title */
  label: string;
  /** Value/details */
  value?: string;
  /** Status */
  status: 'loading' | 'success' | 'error';
  /** Visible */
  visible?: boolean;
  /** Position */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  /** Test ID */
  testId?: string;
}

/**
 * Notification overlay for target page feedback
 */
export const NotificationOverlay = memo<NotificationOverlayProps>(({
  label,
  value,
  status,
  visible = true,
  position = 'top-right',
  testId = 'notification-overlay',
}) => {
  if (!visible) return null;

  const statusConfig: Record<string, { icon: string; color: string; text: string }> = {
    loading: { icon: '⏳', color: 'border-blue-500', text: 'Processing...' },
    success: { icon: '✅', color: 'border-green-500', text: 'Success' },
    error: { icon: '❌', color: 'border-red-500', text: 'Failed' },
  };

  const { icon, color, text } = statusConfig[status];

  const positionStyles: Record<string, string> = {
    'top-right': 'top-16 right-5',
    'top-left': 'top-16 left-5',
    'bottom-right': 'bottom-5 right-5',
    'bottom-left': 'bottom-5 left-5',
  };

  return (
    <div
      className={`
        fixed ${positionStyles[position]} z-[999999]
        w-72 p-3 rounded-lg
        bg-black/85 text-white text-sm
        shadow-lg border-l-4 ${color}
      `}
      data-testid={testId}
    >
      <div className="font-semibold mb-1">{label}</div>
      {value && <div className="opacity-80 mb-2">{value}</div>}
      <div className={`flex items-center gap-2 ${status === 'error' ? 'text-red-400' : status === 'success' ? 'text-green-400' : 'text-blue-400'}`}>
        <span>{icon}</span>
        <span>{text}</span>
      </div>
    </div>
  );
});

NotificationOverlay.displayName = 'NotificationOverlay';

// ============================================================================
// HELPER ICON COMPONENTS
// ============================================================================

interface DefaultIconProps {
  variant: AlertVariant;
  className?: string;
}

const DefaultIcon: React.FC<DefaultIconProps> = ({ variant, className }) => {
  switch (variant) {
    case 'success':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'warning':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    case 'error':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'info':
    default:
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
  }
};

const CloseIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// ============================================================================
// CSS ANIMATION (add to Tailwind config)
// ============================================================================

/**
 * Add to tailwind.config.js:
 * 
 * module.exports = {
 *   theme: {
 *     extend: {
 *       keyframes: {
 *         'slide-in': {
 *           '0%': { transform: 'translateX(100%)', opacity: '0' },
 *           '100%': { transform: 'translateX(0)', opacity: '1' },
 *         },
 *       },
 *       animation: {
 *         'slide-in': 'slide-in 0.3s ease-out',
 *       },
 *     },
 *   },
 * };
 */

// ============================================================================
// EXPORTS
// ============================================================================

export default Alert;
