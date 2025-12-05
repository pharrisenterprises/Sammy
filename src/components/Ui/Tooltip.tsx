/**
 * Tooltip - Contextual hint component
 * @module components/Ui/Tooltip
 * @version 1.0.0
 * 
 * Provides tooltips with multiple features:
 * - Placement: top, bottom, left, right (with alignment)
 * - Trigger: hover, focus, click, or controlled
 * - Delay: configurable show/hide delays
 * - Arrow: optional pointer arrow
 * 
 * @example
 * ```tsx
 * <Tooltip content="Save changes">
 *   <Button>Save</Button>
 * </Tooltip>
 * 
 * <Tooltip content="Delete this item" side="bottom" variant="error">
 *   <IconButton icon={<TrashIcon />} />
 * </Tooltip>
 * ```
 */

import React, {
  memo,
  useState,
  useRef,
  useEffect,
  useCallback,
  createContext,
  useContext,
  useMemo,
} from 'react';
import { createPortal } from 'react-dom';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Tooltip placement side
 */
export type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

/**
 * Tooltip alignment
 */
export type TooltipAlign = 'start' | 'center' | 'end';

/**
 * Tooltip variant
 */
export type TooltipVariant = 'default' | 'dark' | 'light' | 'info' | 'success' | 'warning' | 'error';

/**
 * Tooltip trigger mode
 */
export type TooltipTrigger = 'hover' | 'focus' | 'click' | 'manual';

/**
 * Tooltip props
 */
export interface TooltipProps {
  /** Tooltip content */
  content: React.ReactNode;
  /** Trigger element */
  children: React.ReactElement;
  /** Placement side */
  side?: TooltipSide;
  /** Alignment on the side */
  align?: TooltipAlign;
  /** Visual variant */
  variant?: TooltipVariant;
  /** Trigger mode */
  trigger?: TooltipTrigger;
  /** Show delay in ms */
  delayShow?: number;
  /** Hide delay in ms */
  delayHide?: number;
  /** Show arrow */
  showArrow?: boolean;
  /** Offset from trigger */
  offset?: number;
  /** Controlled open state */
  open?: boolean;
  /** Callback when open changes */
  onOpenChange?: (open: boolean) => void;
  /** Disable tooltip */
  disabled?: boolean;
  /** Max width */
  maxWidth?: number | string;
  /** Additional CSS classes for content */
  className?: string;
  /** Test ID */
  testId?: string;
  /** Accessible label */
  'aria-label'?: string;
}

/**
 * Tooltip provider props
 */
export interface TooltipProviderProps {
  /** Default delay for all tooltips */
  delayShow?: number;
  /** Default hide delay */
  delayHide?: number;
  /** Skip delay on consecutive hovers */
  skipDelayDuration?: number;
  /** Children */
  children: React.ReactNode;
}

/**
 * Position calculation result
 */
interface Position {
  top: number;
  left: number;
  actualSide: TooltipSide;
}

// ============================================================================
// CONTEXT
// ============================================================================

interface TooltipContextValue {
  delayShow: number;
  delayHide: number;
  skipDelayDuration: number;
  lastHideTime: React.MutableRefObject<number>;
}

const TooltipContext = createContext<TooltipContextValue | null>(null);

/**
 * Tooltip provider for global configuration
 */
export const TooltipProvider: React.FC<TooltipProviderProps> = ({
  delayShow = 300,
  delayHide = 0,
  skipDelayDuration = 300,
  children,
}) => {
  const lastHideTime = useRef<number>(0);

  const value = useMemo(
    () => ({
      delayShow,
      delayHide,
      skipDelayDuration,
      lastHideTime,
    }),
    [delayShow, delayHide, skipDelayDuration]
  );

  return (
    <TooltipContext.Provider value={value}>
      {children}
    </TooltipContext.Provider>
  );
};

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Variant styles
 */
const VARIANT_STYLES: Record<TooltipVariant, string> = {
  default: 'bg-gray-900 text-white',
  dark: 'bg-black text-white',
  light: 'bg-white text-gray-900 border border-gray-200 shadow-lg',
  info: 'bg-blue-600 text-white',
  success: 'bg-green-600 text-white',
  warning: 'bg-yellow-500 text-gray-900',
  error: 'bg-red-600 text-white',
};

/**
 * Arrow colors by variant
 */
const ARROW_COLORS: Record<TooltipVariant, string> = {
  default: '#111827',
  dark: '#000000',
  light: '#ffffff',
  info: '#2563eb',
  success: '#16a34a',
  warning: '#eab308',
  error: '#dc2626',
};

/**
 * Default offset
 */
const DEFAULT_OFFSET = 8;

/**
 * Arrow size
 */
const ARROW_SIZE = 6;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate tooltip position
 */
const calculatePosition = (
  triggerRect: DOMRect,
  tooltipRect: DOMRect,
  side: TooltipSide,
  align: TooltipAlign,
  offset: number
): Position => {
  let top = 0;
  let left = 0;
  let actualSide = side;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Calculate initial position based on side
  switch (side) {
    case 'top':
      top = triggerRect.top - tooltipRect.height - offset;
      break;
    case 'bottom':
      top = triggerRect.bottom + offset;
      break;
    case 'left':
      left = triggerRect.left - tooltipRect.width - offset;
      break;
    case 'right':
      left = triggerRect.right + offset;
      break;
  }

  // Calculate alignment
  if (side === 'top' || side === 'bottom') {
    switch (align) {
      case 'start':
        left = triggerRect.left;
        break;
      case 'center':
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case 'end':
        left = triggerRect.right - tooltipRect.width;
        break;
    }
  } else {
    switch (align) {
      case 'start':
        top = triggerRect.top;
        break;
      case 'center':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        break;
      case 'end':
        top = triggerRect.bottom - tooltipRect.height;
        break;
    }
  }

  // Flip if out of viewport
  if (side === 'top' && top < 0) {
    top = triggerRect.bottom + offset;
    actualSide = 'bottom';
  } else if (side === 'bottom' && top + tooltipRect.height > viewportHeight) {
    top = triggerRect.top - tooltipRect.height - offset;
    actualSide = 'top';
  } else if (side === 'left' && left < 0) {
    left = triggerRect.right + offset;
    actualSide = 'right';
  } else if (side === 'right' && left + tooltipRect.width > viewportWidth) {
    left = triggerRect.left - tooltipRect.width - offset;
    actualSide = 'left';
  }

  // Keep within viewport bounds
  left = Math.max(8, Math.min(left, viewportWidth - tooltipRect.width - 8));
  top = Math.max(8, Math.min(top, viewportHeight - tooltipRect.height - 8));

  return { top, left, actualSide };
};

/**
 * Get arrow position styles
 */
const getArrowStyles = (
  side: TooltipSide,
  color: string
): React.CSSProperties => {
  const base: React.CSSProperties = {
    position: 'absolute',
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderWidth: ARROW_SIZE,
    borderColor: 'transparent',
  };

  switch (side) {
    case 'top':
      return {
        ...base,
        bottom: -ARROW_SIZE * 2,
        left: '50%',
        transform: 'translateX(-50%)',
        borderTopColor: color,
        borderBottomWidth: 0,
      };
    case 'bottom':
      return {
        ...base,
        top: -ARROW_SIZE,
        left: '50%',
        transform: 'translateX(-50%)',
        borderBottomColor: color,
        borderTopWidth: 0,
      };
    case 'left':
      return {
        ...base,
        right: -ARROW_SIZE * 2,
        top: '50%',
        transform: 'translateY(-50%)',
        borderLeftColor: color,
        borderRightWidth: 0,
      };
    case 'right':
      return {
        ...base,
        left: -ARROW_SIZE,
        top: '50%',
        transform: 'translateY(-50%)',
        borderRightColor: color,
        borderLeftWidth: 0,
      };
  }
};

// ============================================================================
// TOOLTIP CONTENT COMPONENT
// ============================================================================

interface TooltipContentProps {
  content: React.ReactNode;
  triggerRef: React.RefObject<HTMLElement>;
  side: TooltipSide;
  align: TooltipAlign;
  variant: TooltipVariant;
  showArrow: boolean;
  offset: number;
  maxWidth: number | string;
  className: string;
  testId: string;
  onClose: () => void;
}

const TooltipContent: React.FC<TooltipContentProps> = ({
  content,
  triggerRef,
  side,
  align,
  variant,
  showArrow,
  offset,
  maxWidth,
  className,
  testId,
  onClose,
}) => {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  // Calculate position
  useEffect(() => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const totalOffset = offset + (showArrow ? ARROW_SIZE : 0);

    const pos = calculatePosition(triggerRect, tooltipRect, side, align, totalOffset);
    setPosition(pos);

    // Animate in
    requestAnimationFrame(() => {
      setIsVisible(true);
    });
  }, [side, align, offset, showArrow, triggerRef]);

  // Close on scroll
  useEffect(() => {
    const handleScroll = () => onClose();
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [onClose]);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const arrowColor = ARROW_COLORS[variant];

  return createPortal(
    <div
      ref={tooltipRef}
      role="tooltip"
      className={`
        fixed z-[9999] px-3 py-1.5 text-sm rounded-md
        transition-opacity duration-150
        ${isVisible ? 'opacity-100' : 'opacity-0'}
        ${VARIANT_STYLES[variant]}
        ${className}
      `}
      style={{
        top: position?.top ?? -9999,
        left: position?.left ?? -9999,
        maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth,
        pointerEvents: 'none',
      }}
      data-testid={testId}
      data-side={position?.actualSide}
    >
      {content}
      
      {showArrow && position && (
        <div
          style={getArrowStyles(position.actualSide, arrowColor)}
          data-testid={`${testId}-arrow`}
        />
      )}
    </div>,
    document.body
  );
};

// ============================================================================
// MAIN TOOLTIP COMPONENT
// ============================================================================

/**
 * Tooltip component
 */
export const Tooltip = memo<TooltipProps>(({
  content,
  children,
  side = 'top',
  align = 'center',
  variant = 'default',
  trigger = 'hover',
  delayShow: propDelayShow,
  delayHide: propDelayHide,
  showArrow = true,
  offset = DEFAULT_OFFSET,
  open: controlledOpen,
  onOpenChange,
  disabled = false,
  maxWidth = 300,
  className = '',
  testId = 'tooltip',
  'aria-label': ariaLabel,
}) => {
  // Get context defaults
  const context = useContext(TooltipContext);
  
  const delayShow = propDelayShow ?? context?.delayShow ?? 300;
  const delayHide = propDelayHide ?? context?.delayHide ?? 0;
  const skipDelayDuration = context?.skipDelayDuration ?? 300;
  const lastHideTime = context?.lastHideTime;

  // State
  const [internalOpen, setInternalOpen] = useState(false);
  const triggerRef = useRef<HTMLElement>(null);
  const showTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Controlled vs uncontrolled
  const isOpen = controlledOpen ?? internalOpen;

  // Clear timeouts
  const clearTimeouts = useCallback(() => {
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  // Set open state
  const setOpen = useCallback((newOpen: boolean) => {
    if (controlledOpen === undefined) {
      setInternalOpen(newOpen);
    }
    onOpenChange?.(newOpen);
    
    // Track hide time for skip delay
    if (!newOpen && lastHideTime) {
      lastHideTime.current = Date.now();
    }
  }, [controlledOpen, onOpenChange, lastHideTime]);

  // Show tooltip
  const show = useCallback(() => {
    if (disabled) return;
    
    clearTimeouts();
    
    // Skip delay if recently hidden
    const shouldSkipDelay = lastHideTime && 
      Date.now() - lastHideTime.current < skipDelayDuration;
    
    const delay = shouldSkipDelay ? 0 : delayShow;
    
    if (delay > 0) {
      showTimeoutRef.current = setTimeout(() => {
        setOpen(true);
      }, delay);
    } else {
      setOpen(true);
    }
  }, [disabled, clearTimeouts, delayShow, skipDelayDuration, lastHideTime, setOpen]);

  // Hide tooltip
  const hide = useCallback(() => {
    clearTimeouts();
    
    if (delayHide > 0) {
      hideTimeoutRef.current = setTimeout(() => {
        setOpen(false);
      }, delayHide);
    } else {
      setOpen(false);
    }
  }, [clearTimeouts, delayHide, setOpen]);

  // Toggle (for click trigger)
  const toggle = useCallback(() => {
    if (isOpen) {
      hide();
    } else {
      show();
    }
  }, [isOpen, show, hide]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearTimeouts();
  }, [clearTimeouts]);

  // Don't render if disabled or no content
  if (disabled || !content) {
    return children;
  }

  // Clone child with event handlers
  const childElement = React.cloneElement(children, {
    ref: (node: HTMLElement | null) => {
      // Handle both ref and callback refs
      (triggerRef as React.MutableRefObject<HTMLElement | null>).current = node;
      
      // Forward ref if child has one
      const childRef = (children as any).ref;
      if (typeof childRef === 'function') {
        childRef(node);
      } else if (childRef && 'current' in childRef) {
        childRef.current = node;
      }
    },
    'aria-describedby': isOpen ? testId : undefined,
    ...(trigger === 'hover' && {
      onMouseEnter: (e: React.MouseEvent) => {
        show();
        children.props.onMouseEnter?.(e);
      },
      onMouseLeave: (e: React.MouseEvent) => {
        hide();
        children.props.onMouseLeave?.(e);
      },
    }),
    ...(trigger === 'focus' && {
      onFocus: (e: React.FocusEvent) => {
        show();
        children.props.onFocus?.(e);
      },
      onBlur: (e: React.FocusEvent) => {
        hide();
        children.props.onBlur?.(e);
      },
    }),
    ...(trigger === 'click' && {
      onClick: (e: React.MouseEvent) => {
        toggle();
        children.props.onClick?.(e);
      },
    }),
    ...(trigger === 'hover' && {
      onFocus: (e: React.FocusEvent) => {
        show();
        children.props.onFocus?.(e);
      },
      onBlur: (e: React.FocusEvent) => {
        hide();
        children.props.onBlur?.(e);
      },
    }),
  });

  return (
    <>
      {childElement}
      
      {isOpen && (
        <TooltipContent
          content={content}
          triggerRef={triggerRef}
          side={side}
          align={align}
          variant={variant}
          showArrow={showArrow}
          offset={offset}
          maxWidth={maxWidth}
          className={className}
          testId={testId}
          onClose={hide}
        />
      )}
    </>
  );
});

Tooltip.displayName = 'Tooltip';

// ============================================================================
// SIMPLE TOOLTIP COMPONENT
// ============================================================================

/**
 * Simple tooltip with just text content
 */
export interface SimpleTooltipProps {
  /** Tooltip text */
  text: string;
  /** Trigger element */
  children: React.ReactElement;
  /** Position */
  position?: TooltipSide;
  /** Disabled */
  disabled?: boolean;
  /** Test ID */
  testId?: string;
}

export const SimpleTooltip = memo<SimpleTooltipProps>(({
  text,
  children,
  position = 'top',
  disabled = false,
  testId = 'simple-tooltip',
}) => (
  <Tooltip
    content={text}
    side={position}
    disabled={disabled}
    testId={testId}
  >
    {children}
  </Tooltip>
));

SimpleTooltip.displayName = 'SimpleTooltip';

// ============================================================================
// ICON TOOLTIP COMPONENT
// ============================================================================

/**
 * Tooltip specifically for icon buttons
 */
export interface IconTooltipProps {
  /** Tooltip text */
  label: string;
  /** Icon element */
  children: React.ReactElement;
  /** Position */
  position?: TooltipSide;
  /** Test ID */
  testId?: string;
}

export const IconTooltip = memo<IconTooltipProps>(({
  label,
  children,
  position = 'top',
  testId = 'icon-tooltip',
}) => (
  <Tooltip
    content={label}
    side={position}
    delayShow={500}
    testId={testId}
    aria-label={label}
  >
    {children}
  </Tooltip>
));

IconTooltip.displayName = 'IconTooltip';

// ============================================================================
// INFO TOOLTIP COMPONENT
// ============================================================================

/**
 * Info tooltip with icon
 */
export interface InfoTooltipProps {
  /** Info content */
  content: React.ReactNode;
  /** Icon size */
  iconSize?: 'sm' | 'md' | 'lg';
  /** Position */
  position?: TooltipSide;
  /** Test ID */
  testId?: string;
}

const iconSizes = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

export const InfoTooltip = memo<InfoTooltipProps>(({
  content,
  iconSize = 'md',
  position = 'top',
  testId = 'info-tooltip',
}) => (
  <Tooltip
    content={content}
    side={position}
    variant="info"
    testId={testId}
  >
    <button
      type="button"
      className="inline-flex items-center justify-center text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full"
      aria-label="More information"
    >
      <InfoIcon className={iconSizes[iconSize]} />
    </button>
  </Tooltip>
));

InfoTooltip.displayName = 'InfoTooltip';

// ============================================================================
// TRUNCATED TEXT WITH TOOLTIP
// ============================================================================

/**
 * Text that shows full content in tooltip when truncated
 */
export interface TruncatedTextProps {
  /** Full text */
  text: string;
  /** Max width */
  maxWidth?: number | string;
  /** Additional classes */
  className?: string;
  /** Test ID */
  testId?: string;
}

export const TruncatedText = memo<TruncatedTextProps>(({
  text,
  maxWidth = 200,
  className = '',
  testId = 'truncated-text',
}) => {
  const textRef = useRef<HTMLSpanElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const el = textRef.current;
    if (el) {
      setIsTruncated(el.scrollWidth > el.clientWidth);
    }
  }, [text]);

  const textElement = (
    <span
      ref={textRef}
      className={`block truncate ${className}`}
      style={{ maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth }}
      data-testid={testId}
    >
      {text}
    </span>
  );

  if (!isTruncated) {
    return textElement;
  }

  return (
    <Tooltip
      content={text}
      side="top"
      maxWidth={400}
      testId={`${testId}-tooltip`}
    >
      {textElement}
    </Tooltip>
  );
});

TruncatedText.displayName = 'TruncatedText';

// ============================================================================
// KEYBOARD SHORTCUT TOOLTIP
// ============================================================================

/**
 * Tooltip showing keyboard shortcut
 */
export interface ShortcutTooltipProps {
  /** Action label */
  label: string;
  /** Keyboard shortcut (e.g., "Ctrl+S") */
  shortcut: string;
  /** Trigger element */
  children: React.ReactElement;
  /** Position */
  position?: TooltipSide;
  /** Test ID */
  testId?: string;
}

export const ShortcutTooltip = memo<ShortcutTooltipProps>(({
  label,
  shortcut,
  children,
  position = 'bottom',
  testId = 'shortcut-tooltip',
}) => {
  // Parse shortcut keys
  const keys = shortcut.split('+').map((key) => key.trim());

  const content = (
    <div className="flex items-center gap-2">
      <span>{label}</span>
      <div className="flex items-center gap-0.5">
        {keys.map((key, index) => (
          <React.Fragment key={key}>
            <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-xs font-mono">
              {key}
            </kbd>
            {index < keys.length - 1 && <span className="text-gray-400">+</span>}
          </React.Fragment>
        ))}
      </div>
    </div>
  );

  return (
    <Tooltip
      content={content}
      side={position}
      testId={testId}
    >
      {children}
    </Tooltip>
  );
});

ShortcutTooltip.displayName = 'ShortcutTooltip';

// ============================================================================
// HELPER ICON COMPONENTS
// ============================================================================

/**
 * Info icon
 */
const InfoIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

// ============================================================================
// EXPORTS
// ============================================================================

export default Tooltip;
