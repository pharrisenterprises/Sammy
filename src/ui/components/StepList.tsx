/**
 * StepList - Displays recorded steps in a list
 * @module ui/components/StepList
 * @version 1.0.0
 * 
 * Renders recorded steps with visual indicators for step type,
 * status, and target elements. Supports selection and actions.
 * 
 * Features:
 * - Step type icons and colors
 * - Step description and target info
 * - Selection (single and multi)
 * - Reordering via drag-and-drop
 * - Step status indicators
 * - Context menu actions
 * - Empty state handling
 * - Keyboard navigation
 * 
 * @see ui-components_breakdown.md for architecture details
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { RecordedStep, StepType } from '../../core/types/steps';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Step type icons
 */
export const STEP_ICONS: Record<StepType, string> = {
  click: '🖱️',
  doubleClick: '🖱️',
  input: '⌨️',
  keypress: '⌨️',
  select: '📋',
  hover: '👆',
  scroll: '📜',
  focus: '🎯',
  blur: '💨',
  submit: '📤',
  navigate: '🌐',
  wait: '⏳',
  assert: '✅',
  screenshot: '📷',
  drag: '✊',
  drop: '📥',
  upload: '📎',
  download: '💾',
};

/**
 * Step type colors
 */
export const STEP_COLORS: Record<StepType, string> = {
  click: '#3b82f6',
  doubleClick: '#3b82f6',
  input: '#8b5cf6',
  keypress: '#8b5cf6',
  select: '#06b6d4',
  hover: '#f59e0b',
  scroll: '#6b7280',
  focus: '#10b981',
  blur: '#6b7280',
  submit: '#ef4444',
  navigate: '#ec4899',
  wait: '#f59e0b',
  assert: '#10b981',
  screenshot: '#6366f1',
  drag: '#f97316',
  drop: '#f97316',
  upload: '#14b8a6',
  download: '#14b8a6',
};

/**
 * Step status values
 */
export const STEP_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  PASSED: 'passed',
  FAILED: 'failed',
  SKIPPED: 'skipped',
} as const;

/**
 * Step status type
 */
export type StepStatus = typeof STEP_STATUS[keyof typeof STEP_STATUS];

/**
 * Step status colors
 */
export const STATUS_COLORS: Record<StepStatus, string> = {
  pending: '#6b7280',
  running: '#3b82f6',
  passed: '#10b981',
  failed: '#ef4444',
  skipped: '#f59e0b',
};

// ============================================================================
// TYPES
// ============================================================================

/**
 * Extended step with UI state
 */
export interface StepListItem extends RecordedStep {
  /** Step status */
  status?: StepStatus;
  /** Error message if failed */
  error?: string;
  /** Duration in ms */
  duration?: number;
}

/**
 * StepList props
 */
export interface StepListProps {
  /** Steps to display */
  steps: StepListItem[];
  /** Selected step IDs */
  selectedIds?: string[];
  /** Currently executing step index */
  currentStepIndex?: number;
  /** Whether list is read-only */
  readOnly?: boolean;
  /** Whether to show step numbers */
  showNumbers?: boolean;
  /** Whether to show step status */
  showStatus?: boolean;
  /** Whether to show step duration */
  showDuration?: boolean;
  /** Whether to enable multi-select */
  multiSelect?: boolean;
  /** Whether to enable drag reordering */
  enableReorder?: boolean;
  /** Maximum height before scrolling */
  maxHeight?: number | string;
  /** Empty state message */
  emptyMessage?: string;
  /** Size variant */
  size?: 'small' | 'medium' | 'large';
  /** On step click */
  onStepClick?: (step: StepListItem, index: number) => void;
  /** On step double click */
  onStepDoubleClick?: (step: StepListItem, index: number) => void;
  /** On selection change */
  onSelectionChange?: (selectedIds: string[]) => void;
  /** On step reorder */
  onReorder?: (fromIndex: number, toIndex: number) => void;
  /** On step delete */
  onDelete?: (step: StepListItem, index: number) => void;
  /** On step edit */
  onEdit?: (step: StepListItem, index: number) => void;
  /** On step duplicate */
  onDuplicate?: (step: StepListItem, index: number) => void;
  /** Custom class name */
  className?: string;
  /** Custom styles */
  style?: React.CSSProperties;
}

/**
 * Step item props
 */
interface StepItemProps {
  step: StepListItem;
  index: number;
  isSelected: boolean;
  isCurrent: boolean;
  showNumber: boolean;
  showStatus: boolean;
  showDuration: boolean;
  size: 'small' | 'medium' | 'large';
  readOnly: boolean;
  enableReorder: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

// ============================================================================
// STYLES
// ============================================================================

const createStyles = (size: 'small' | 'medium' | 'large') => {
  const sizes = {
    small: {
      padding: '8px 10px',
      fontSize: '12px',
      iconSize: '14px',
      gap: '6px',
    },
    medium: {
      padding: '10px 12px',
      fontSize: '13px',
      iconSize: '16px',
      gap: '8px',
    },
    large: {
      padding: '12px 16px',
      fontSize: '14px',
      iconSize: '18px',
      gap: '10px',
    },
  };
  
  const s = sizes[size];
  
  return {
    container: {
      display: 'flex',
      flexDirection: 'column' as const,
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      backgroundColor: '#ffffff',
      overflow: 'hidden',
    },
    list: {
      display: 'flex',
      flexDirection: 'column' as const,
      overflowY: 'auto' as const,
    },
    item: {
      display: 'flex',
      alignItems: 'center',
      gap: s.gap,
      padding: s.padding,
      borderBottom: '1px solid #f3f4f6',
      cursor: 'pointer',
      transition: 'background-color 0.15s',
      fontSize: s.fontSize,
    },
    itemSelected: {
      backgroundColor: '#eff6ff',
    },
    itemCurrent: {
      backgroundColor: '#fef3c7',
      borderLeft: '3px solid #f59e0b',
    },
    itemHover: {
      backgroundColor: '#f9fafb',
    },
    dragHandle: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '20px',
      color: '#9ca3af',
      cursor: 'grab',
      fontSize: s.iconSize,
    },
    stepNumber: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: '24px',
      height: '24px',
      borderRadius: '4px',
      backgroundColor: '#f3f4f6',
      fontSize: '11px',
      fontWeight: 500,
      color: '#6b7280',
    },
    stepIcon: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '28px',
      height: '28px',
      borderRadius: '6px',
      fontSize: s.iconSize,
    },
    stepContent: {
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '2px',
    },
    stepType: {
      fontWeight: 500,
      color: '#1f2937',
      textTransform: 'capitalize' as const,
    },
    stepDescription: {
      fontSize: '12px',
      color: '#6b7280',
      whiteSpace: 'nowrap' as const,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
    stepTarget: {
      fontSize: '11px',
      color: '#9ca3af',
      fontFamily: 'monospace',
      whiteSpace: 'nowrap' as const,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
    stepMeta: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    },
    statusIndicator: {
      width: '8px',
      height: '8px',
      borderRadius: '50%',
    },
    duration: {
      fontSize: '11px',
      color: '#9ca3af',
    },
    emptyState: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 16px',
      textAlign: 'center' as const,
      color: '#6b7280',
    },
    emptyIcon: {
      fontSize: '32px',
      marginBottom: '12px',
      opacity: 0.5,
    },
    emptyText: {
      fontSize: '13px',
      lineHeight: 1.5,
    },
    contextMenu: {
      position: 'fixed' as const,
      backgroundColor: '#ffffff',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      padding: '4px 0',
      minWidth: '160px',
      zIndex: 1000,
    },
    contextMenuItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 12px',
      fontSize: '13px',
      color: '#374151',
      cursor: 'pointer',
      transition: 'background-color 0.1s',
    },
    contextMenuItemHover: {
      backgroundColor: '#f3f4f6',
    },
    contextMenuItemDanger: {
      color: '#ef4444',
    },
    contextMenuDivider: {
      height: '1px',
      backgroundColor: '#e5e7eb',
      margin: '4px 0',
    },
  } as const;
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Gets description for a step
 */
function getStepDescription(step: StepListItem): string {
  if (step.description) return step.description;
  
  switch (step.type) {
    case 'click':
      return `Click on ${step.target?.tagName?.toLowerCase() ?? 'element'}`;
    case 'doubleClick':
      return `Double-click on ${step.target?.tagName?.toLowerCase() ?? 'element'}`;
    case 'input':
      return step.value ? `Type "${truncate(step.value, 30)}"` : 'Type text';
    case 'keypress':
      return `Press ${step.key ?? 'key'}`;
    case 'select':
      return `Select "${truncate(step.value ?? '', 30)}"`;
    case 'hover':
      return `Hover over ${step.target?.tagName?.toLowerCase() ?? 'element'}`;
    case 'scroll':
      return 'Scroll page';
    case 'focus':
      return `Focus on ${step.target?.tagName?.toLowerCase() ?? 'element'}`;
    case 'blur':
      return 'Remove focus';
    case 'submit':
      return 'Submit form';
    case 'navigate':
      return step.url ? `Navigate to ${truncate(step.url, 40)}` : 'Navigate';
    case 'wait':
      return step.waitTime ? `Wait ${step.waitTime}ms` : 'Wait for element';
    case 'assert':
      return step.assertion?.type ? `Assert ${step.assertion.type}` : 'Assert';
    case 'screenshot':
      return 'Take screenshot';
    case 'drag':
      return 'Drag element';
    case 'drop':
      return 'Drop element';
    case 'upload':
      return 'Upload file';
    case 'download':
      return 'Download file';
    default:
      return step.type;
  }
}

/**
 * Gets target display string
 */
function getTargetDisplay(step: StepListItem): string {
  if (!step.target) return '';
  
  const { target } = step;
  
  // Prefer readable identifiers
  if (target.testId) return `[data-testid="${target.testId}"]`;
  if (target.id) return `#${target.id}`;
  if (target.name) return `[name="${target.name}"]`;
  if (target.ariaLabel) return `[aria-label="${target.ariaLabel}"]`;
  if (target.cssSelector) return truncate(target.cssSelector, 50);
  if (target.xpath) return truncate(target.xpath, 50);
  
  return target.tagName?.toLowerCase() ?? '';
}

/**
 * Truncates string with ellipsis
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Formats duration
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ============================================================================
// STEP ITEM COMPONENT
// ============================================================================

const StepItem: React.FC<StepItemProps> = ({
  step,
  index,
  isSelected,
  isCurrent,
  showNumber,
  showStatus,
  showDuration,
  size,
  readOnly,
  enableReorder,
  onClick,
  onDoubleClick,
  onDragStart,
  onDragOver,
  onDrop,
  onContextMenu,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const styles = useMemo(() => createStyles(size), [size]);
  
  const itemStyle: React.CSSProperties = {
    ...styles.item,
    ...(isSelected ? styles.itemSelected : {}),
    ...(isCurrent ? styles.itemCurrent : {}),
    ...(isHovered && !isSelected && !isCurrent ? styles.itemHover : {}),
  };
  
  const iconStyle: React.CSSProperties = {
    ...styles.stepIcon,
    backgroundColor: `${STEP_COLORS[step.type]}15`,
    color: STEP_COLORS[step.type],
  };
  
  return (
    <div
      style={itemStyle}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onContextMenu={onContextMenu}
      draggable={enableReorder && !readOnly}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      data-testid={`step-item-${index}`}
      role="listitem"
      aria-selected={isSelected}
    >
      {/* Drag handle */}
      {enableReorder && !readOnly && (
        <div style={styles.dragHandle} data-testid="drag-handle">
          ⋮⋮
        </div>
      )}
      
      {/* Step number */}
      {showNumber && (
        <div style={styles.stepNumber} data-testid="step-number">
          {index + 1}
        </div>
      )}
      
      {/* Step icon */}
      <div style={iconStyle} data-testid="step-icon">
        {STEP_ICONS[step.type] ?? '❓'}
      </div>
      
      {/* Step content */}
      <div style={styles.stepContent}>
        <div style={styles.stepType}>{step.type}</div>
        <div style={styles.stepDescription} title={getStepDescription(step)}>
          {getStepDescription(step)}
        </div>
        {step.target && (
          <div style={styles.stepTarget} title={getTargetDisplay(step)}>
            {getTargetDisplay(step)}
          </div>
        )}
      </div>
      
      {/* Step meta */}
      <div style={styles.stepMeta}>
        {showStatus && step.status && (
          <div
            style={{
              ...styles.statusIndicator,
              backgroundColor: STATUS_COLORS[step.status],
            }}
            title={step.status}
            data-testid="step-status"
          />
        )}
        {showDuration && step.duration !== undefined && (
          <div style={styles.duration} data-testid="step-duration">
            {formatDuration(step.duration)}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// CONTEXT MENU COMPONENT
// ============================================================================

interface ContextMenuProps {
  x: number;
  y: number;
  step: StepListItem;
  index: number;
  readOnly: boolean;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onClose: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  step,
  index,
  readOnly,
  onEdit,
  onDuplicate,
  onDelete,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const styles = createStyles('medium');
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  
  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);
  
  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);
  
  return (
    <div
      ref={menuRef}
      style={{ ...styles.contextMenu, left: x, top: y }}
      data-testid="context-menu"
    >
      {!readOnly && onEdit && (
        <div
          style={{
            ...styles.contextMenuItem,
            ...(hoveredItem === 'edit' ? styles.contextMenuItemHover : {}),
          }}
          onMouseEnter={() => setHoveredItem('edit')}
          onMouseLeave={() => setHoveredItem(null)}
          onClick={() => { onEdit(); onClose(); }}
          data-testid="menu-edit"
        >
          ✏️ Edit Step
        </div>
      )}
      {!readOnly && onDuplicate && (
        <div
          style={{
            ...styles.contextMenuItem,
            ...(hoveredItem === 'duplicate' ? styles.contextMenuItemHover : {}),
          }}
          onMouseEnter={() => setHoveredItem('duplicate')}
          onMouseLeave={() => setHoveredItem(null)}
          onClick={() => { onDuplicate(); onClose(); }}
          data-testid="menu-duplicate"
        >
          📋 Duplicate
        </div>
      )}
      {!readOnly && (onEdit || onDuplicate) && onDelete && (
        <div style={styles.contextMenuDivider} />
      )}
      {!readOnly && onDelete && (
        <div
          style={{
            ...styles.contextMenuItem,
            ...styles.contextMenuItemDanger,
            ...(hoveredItem === 'delete' ? styles.contextMenuItemHover : {}),
          }}
          onMouseEnter={() => setHoveredItem('delete')}
          onMouseLeave={() => setHoveredItem(null)}
          onClick={() => { onDelete(); onClose(); }}
          data-testid="menu-delete"
        >
          🗑️ Delete
        </div>
      )}
      {readOnly && (
        <div style={{ ...styles.contextMenuItem, color: '#9ca3af' }}>
          No actions available
        </div>
      )}
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * StepList - Displays recorded steps
 */
export const StepList: React.FC<StepListProps> = ({
  steps,
  selectedIds = [],
  currentStepIndex,
  readOnly = false,
  showNumbers = true,
  showStatus = false,
  showDuration = false,
  multiSelect = false,
  enableReorder = false,
  maxHeight = 400,
  emptyMessage = 'No steps recorded yet.',
  size = 'medium',
  onStepClick,
  onStepDoubleClick,
  onSelectionChange,
  onReorder,
  onDelete,
  onEdit,
  onDuplicate,
  className,
  style,
}) => {
  const styles = useMemo(() => createStyles(size), [size]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    step: StepListItem;
    index: number;
  } | null>(null);
  
  // Handle step click
  const handleStepClick = useCallback((step: StepListItem, index: number, e: React.MouseEvent) => {
    onStepClick?.(step, index);
    
    if (!onSelectionChange) return;
    
    if (multiSelect && (e.ctrlKey || e.metaKey)) {
      // Toggle selection
      const newSelection = selectedIds.includes(step.id)
        ? selectedIds.filter(id => id !== step.id)
        : [...selectedIds, step.id];
      onSelectionChange(newSelection);
    } else if (multiSelect && e.shiftKey && selectedIds.length > 0) {
      // Range selection
      const lastSelectedIndex = steps.findIndex(s => s.id === selectedIds[selectedIds.length - 1]);
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const rangeIds = steps.slice(start, end + 1).map(s => s.id);
      onSelectionChange(Array.from(new Set([...selectedIds, ...rangeIds])));
    } else {
      // Single selection
      onSelectionChange([step.id]);
    }
  }, [multiSelect, selectedIds, steps, onStepClick, onSelectionChange]);
  
  // Handle drag start
  const handleDragStart = useCallback((index: number, e: React.DragEvent) => {
    if (!enableReorder || readOnly) return;
    
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  }, [enableReorder, readOnly]);
  
  // Handle drag over
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!enableReorder || readOnly) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, [enableReorder, readOnly]);
  
  // Handle drop
  const handleDrop = useCallback((toIndex: number, e: React.DragEvent) => {
    if (!enableReorder || readOnly || draggedIndex === null) return;
    
    e.preventDefault();
    
    if (draggedIndex !== toIndex) {
      onReorder?.(draggedIndex, toIndex);
    }
    
    setDraggedIndex(null);
  }, [enableReorder, readOnly, draggedIndex, onReorder]);
  
  // Handle context menu
  const handleContextMenu = useCallback((step: StepListItem, index: number, e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, step, index });
  }, []);
  
  // Close context menu
  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);
  
  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!onSelectionChange || selectedIds.length === 0) return;
      
      const currentIndex = steps.findIndex(s => s.id === selectedIds[selectedIds.length - 1]);
      
      if (e.key === 'ArrowDown' && currentIndex < steps.length - 1) {
        e.preventDefault();
        onSelectionChange([steps[currentIndex + 1].id]);
      } else if (e.key === 'ArrowUp' && currentIndex > 0) {
        e.preventDefault();
        onSelectionChange([steps[currentIndex - 1].id]);
      } else if (e.key === 'Delete' && !readOnly && onDelete) {
        e.preventDefault();
        const step = steps.find(s => s.id === selectedIds[0]);
        if (step) onDelete(step, currentIndex);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [steps, selectedIds, readOnly, onSelectionChange, onDelete]);
  
  // Empty state
  if (steps.length === 0) {
    return (
      <div
        style={{ ...styles.container, ...style }}
        className={className}
        data-testid="step-list-empty"
      >
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>📝</div>
          <div style={styles.emptyText}>{emptyMessage}</div>
        </div>
      </div>
    );
  }
  
  return (
    <div
      style={{ ...styles.container, ...style }}
      className={className}
      data-testid="step-list"
      role="list"
      aria-label="Recorded steps"
    >
      <div
        style={{ ...styles.list, maxHeight }}
        data-testid="step-list-content"
      >
        {steps.map((step, index) => (
          <StepItem
            key={step.id}
            step={step}
            index={index}
            isSelected={selectedIds.includes(step.id)}
            isCurrent={currentStepIndex === index}
            showNumber={showNumbers}
            showStatus={showStatus}
            showDuration={showDuration}
            size={size}
            readOnly={readOnly}
            enableReorder={enableReorder}
            onClick={(e) => handleStepClick(step, index, e)}
            onDoubleClick={() => onStepDoubleClick?.(step, index)}
            onDragStart={(e) => handleDragStart(index, e)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(index, e)}
            onContextMenu={(e) => handleContextMenu(step, index, e)}
          />
        ))}
      </div>
      
      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          step={contextMenu.step}
          index={contextMenu.index}
          readOnly={readOnly}
          onEdit={onEdit ? () => onEdit(contextMenu.step, contextMenu.index) : undefined}
          onDuplicate={onDuplicate ? () => onDuplicate(contextMenu.step, contextMenu.index) : undefined}
          onDelete={onDelete ? () => onDelete(contextMenu.step, contextMenu.index) : undefined}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
};

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Creates a StepList with preset configuration
 */
export function createStepList(
  preset: 'compact' | 'detailed' | 'replay' = 'detailed'
): React.FC<Omit<StepListProps, 'showNumbers' | 'showStatus' | 'showDuration' | 'size'>> {
  switch (preset) {
    case 'compact':
      return (props) => (
        <StepList {...props} showNumbers={false} showStatus={false} showDuration={false} size="small" />
      );
    case 'replay':
      return (props) => (
        <StepList {...props} showNumbers showStatus showDuration size="medium" readOnly />
      );
    case 'detailed':
    default:
      return (props) => (
        <StepList {...props} showNumbers showStatus={false} showDuration={false} size="medium" />
      );
  }
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default StepList;
