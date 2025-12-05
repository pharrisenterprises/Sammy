/**
 * Table - Data display component
 * @module components/Ui/Table
 * @version 1.0.0
 * 
 * Provides table components with multiple features:
 * - Compound components: Table, TableHeader, TableBody, TableRow, TableCell
 * - Variants: default, striped, bordered
 * - Sortable columns
 * - Selectable rows
 * - Empty and loading states
 * 
 * @example
 * ```tsx
 * <Table>
 *   <TableHeader>
 *     <TableRow>
 *       <TableHead>Step #</TableHead>
 *       <TableHead>Event</TableHead>
 *       <TableHead>Label</TableHead>
 *     </TableRow>
 *   </TableHeader>
 *   <TableBody>
 *     {steps.map(step => (
 *       <TableRow key={step.id}>
 *         <TableCell>{step.id}</TableCell>
 *         <TableCell>{step.event}</TableCell>
 *         <TableCell>{step.label}</TableCell>
 *       </TableRow>
 *     ))}
 *   </TableBody>
 * </Table>
 * ```
 */

import React, { forwardRef, createContext, useContext, memo, useState, useCallback } from 'react';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Table variant
 */
export type TableVariant = 'default' | 'striped' | 'bordered';

/**
 * Table size
 */
export type TableSize = 'sm' | 'md' | 'lg';

/**
 * Sort direction
 */
export type SortDirection = 'asc' | 'desc' | null;

/**
 * Table props
 */
export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  /** Visual variant */
  variant?: TableVariant;
  /** Size (affects padding) */
  size?: TableSize;
  /** Fixed layout */
  fixed?: boolean;
  /** Full width */
  fullWidth?: boolean;
  /** Sticky header */
  stickyHeader?: boolean;
  /** Compact mode */
  compact?: boolean;
  /** Hoverable rows */
  hoverable?: boolean;
  /** Container classes */
  containerClassName?: string;
  /** Test ID */
  testId?: string;
}

/**
 * Table header props
 */
export interface TableHeaderProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  /** Test ID */
  testId?: string;
}

/**
 * Table body props
 */
export interface TableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  /** Test ID */
  testId?: string;
}

/**
 * Table footer props
 */
export interface TableFooterProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  /** Test ID */
  testId?: string;
}

/**
 * Table row props
 */
export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  /** Selected state */
  selected?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Clickable row */
  clickable?: boolean;
  /** Highlighted (e.g., current step) */
  highlighted?: boolean;
  /** Status indicator */
  status?: 'default' | 'success' | 'warning' | 'error' | 'running';
  /** Test ID */
  testId?: string;
}

/**
 * Table head cell props
 */
export interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  /** Sortable column */
  sortable?: boolean;
  /** Current sort direction */
  sortDirection?: SortDirection;
  /** Sort handler */
  onSort?: () => void;
  /** Column width */
  width?: string | number;
  /** Alignment */
  align?: 'left' | 'center' | 'right';
  /** Test ID */
  testId?: string;
}

/**
 * Table cell props
 */
export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  /** Alignment */
  align?: 'left' | 'center' | 'right';
  /** Truncate text */
  truncate?: boolean;
  /** No wrap */
  noWrap?: boolean;
  /** Monospace font */
  mono?: boolean;
  /** Test ID */
  testId?: string;
}

/**
 * Table caption props
 */
export interface TableCaptionProps extends React.HTMLAttributes<HTMLTableCaptionElement> {
  /** Position */
  position?: 'top' | 'bottom';
  /** Test ID */
  testId?: string;
}

// ============================================================================
// CONTEXT
// ============================================================================

interface TableContextValue {
  variant: TableVariant;
  size: TableSize;
  hoverable: boolean;
}

const TableContext = createContext<TableContextValue>({
  variant: 'default',
  size: 'md',
  hoverable: false,
});

const useTableContext = () => useContext(TableContext);

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Size styles
 */
const SIZE_STYLES: Record<TableSize, { head: string; cell: string }> = {
  sm: {
    head: 'px-2 py-1.5 text-xs',
    cell: 'px-2 py-1.5 text-sm',
  },
  md: {
    head: 'px-4 py-3 text-sm',
    cell: 'px-4 py-3 text-sm',
  },
  lg: {
    head: 'px-6 py-4 text-base',
    cell: 'px-6 py-4 text-base',
  },
};

/**
 * Row status styles
 */
const ROW_STATUS_STYLES: Record<string, string> = {
  default: '',
  success: 'bg-green-50',
  warning: 'bg-yellow-50',
  error: 'bg-red-50',
  running: 'bg-blue-50',
};

// ============================================================================
// MAIN TABLE COMPONENT
// ============================================================================

/**
 * Table container component
 */
export const Table = forwardRef<HTMLTableElement, TableProps>(({
  variant = 'default',
  size = 'md',
  fixed = false,
  fullWidth = true,
  stickyHeader = false,
  compact = false,
  hoverable = false,
  containerClassName = '',
  className = '',
  children,
  testId = 'table',
  ...props
}, ref) => {
  const contextValue: TableContextValue = {
    variant,
    size: compact ? 'sm' : size,
    hoverable,
  };

  return (
    <TableContext.Provider value={contextValue}>
      <div
        className={`
          overflow-auto
          ${stickyHeader ? 'max-h-[600px]' : ''}
          ${containerClassName}
        `}
        data-testid={`${testId}-container`}
      >
        <table
          ref={ref}
          className={`
            ${fullWidth ? 'w-full' : ''}
            ${fixed ? 'table-fixed' : 'table-auto'}
            ${variant === 'bordered' ? 'border border-gray-200' : ''}
            border-collapse
            ${className}
          `}
          data-testid={testId}
          data-variant={variant}
          {...props}
        >
          {children}
        </table>
      </div>
    </TableContext.Provider>
  );
});

Table.displayName = 'Table';

// ============================================================================
// TABLE HEADER COMPONENT
// ============================================================================

/**
 * Table header section
 */
export const TableHeader = forwardRef<HTMLTableSectionElement, TableHeaderProps>(({
  className = '',
  children,
  testId = 'table-header',
  ...props
}, ref) => {
  const { variant } = useTableContext();

  return (
    <thead
      ref={ref}
      className={`
        bg-gray-50 border-b border-gray-200
        ${variant === 'bordered' ? 'border' : ''}
        ${className}
      `}
      data-testid={testId}
      {...props}
    >
      {children}
    </thead>
  );
});

TableHeader.displayName = 'TableHeader';

// ============================================================================
// TABLE BODY COMPONENT
// ============================================================================

/**
 * Table body section
 */
export const TableBody = forwardRef<HTMLTableSectionElement, TableBodyProps>(({
  className = '',
  children,
  testId = 'table-body',
  ...props
}, ref) => {
  const { variant } = useTableContext();

  return (
    <tbody
      ref={ref}
      className={`
        bg-white divide-y divide-gray-200
        ${variant === 'bordered' ? '[&>tr]:border' : ''}
        ${className}
      `}
      data-testid={testId}
      {...props}
    >
      {children}
    </tbody>
  );
});

TableBody.displayName = 'TableBody';

// ============================================================================
// TABLE FOOTER COMPONENT
// ============================================================================

/**
 * Table footer section
 */
export const TableFooter = forwardRef<HTMLTableSectionElement, TableFooterProps>(({
  className = '',
  children,
  testId = 'table-footer',
  ...props
}, ref) => (
  <tfoot
    ref={ref}
    className={`bg-gray-50 border-t border-gray-200 ${className}`}
    data-testid={testId}
    {...props}
  >
    {children}
  </tfoot>
));

TableFooter.displayName = 'TableFooter';

// ============================================================================
// TABLE ROW COMPONENT
// ============================================================================

/**
 * Table row
 */
export const TableRow = forwardRef<HTMLTableRowElement, TableRowProps>(({
  selected = false,
  disabled = false,
  clickable = false,
  highlighted = false,
  status = 'default',
  className = '',
  children,
  onClick,
  testId = 'table-row',
  ...props
}, ref) => {
  const { variant, hoverable } = useTableContext();
  const statusStyles = ROW_STATUS_STYLES[status];

  return (
    <tr
      ref={ref}
      className={`
        transition-colors
        ${variant === 'striped' ? 'odd:bg-gray-50' : ''}
        ${variant === 'bordered' ? 'border border-gray-200' : ''}
        ${hoverable && !disabled ? 'hover:bg-gray-50' : ''}
        ${clickable || onClick ? 'cursor-pointer' : ''}
        ${selected ? 'bg-blue-50' : ''}
        ${highlighted ? 'bg-yellow-50 ring-2 ring-yellow-200 ring-inset' : ''}
        ${disabled ? 'opacity-50 pointer-events-none' : ''}
        ${statusStyles}
        ${className}
      `}
      onClick={disabled ? undefined : onClick}
      data-testid={testId}
      data-selected={selected}
      data-highlighted={highlighted}
      data-status={status}
      aria-selected={selected}
      aria-disabled={disabled}
      {...props}
    >
      {children}
    </tr>
  );
});

TableRow.displayName = 'TableRow';

// ============================================================================
// TABLE HEAD CELL COMPONENT
// ============================================================================

/**
 * Table header cell
 */
export const TableHead = forwardRef<HTMLTableCellElement, TableHeadProps>(({
  sortable = false,
  sortDirection,
  onSort,
  width,
  align = 'left',
  className = '',
  children,
  style,
  testId = 'table-head',
  ...props
}, ref) => {
  const { size } = useTableContext();
  const sizeStyles = SIZE_STYLES[size];

  const alignmentStyles = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  const handleClick = sortable && onSort ? onSort : undefined;
  const handleKeyDown = sortable && onSort
    ? (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSort();
        }
      }
    : undefined;

  return (
    <th
      ref={ref}
      className={`
        font-semibold text-gray-700 whitespace-nowrap
        ${sizeStyles.head}
        ${alignmentStyles[align]}
        ${sortable ? 'cursor-pointer select-none hover:bg-gray-100' : ''}
        ${className}
      `}
      style={{ width, ...style }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={sortable ? 0 : undefined}
      aria-sort={
        sortDirection === 'asc' ? 'ascending' :
        sortDirection === 'desc' ? 'descending' :
        undefined
      }
      data-testid={testId}
      data-sortable={sortable}
      data-sort-direction={sortDirection}
      {...props}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sortable && (
          <SortIcon direction={sortDirection} />
        )}
      </span>
    </th>
  );
});

TableHead.displayName = 'TableHead';

// ============================================================================
// TABLE CELL COMPONENT
// ============================================================================

/**
 * Table data cell
 */
export const TableCell = forwardRef<HTMLTableCellElement, TableCellProps>(({
  align = 'left',
  truncate = false,
  noWrap = false,
  mono = false,
  className = '',
  children,
  testId = 'table-cell',
  ...props
}, ref) => {
  const { size } = useTableContext();
  const sizeStyles = SIZE_STYLES[size];

  const alignmentStyles = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  return (
    <td
      ref={ref}
      className={`
        text-gray-900
        ${sizeStyles.cell}
        ${alignmentStyles[align]}
        ${truncate ? 'truncate max-w-xs' : ''}
        ${noWrap ? 'whitespace-nowrap' : ''}
        ${mono ? 'font-mono text-xs' : ''}
        ${className}
      `}
      data-testid={testId}
      {...props}
    >
      {children}
    </td>
  );
});

TableCell.displayName = 'TableCell';

// ============================================================================
// TABLE CAPTION COMPONENT
// ============================================================================

/**
 * Table caption
 */
export const TableCaption = forwardRef<HTMLTableCaptionElement, TableCaptionProps>(({
  position = 'bottom',
  className = '',
  children,
  testId = 'table-caption',
  ...props
}, ref) => (
  <caption
    ref={ref}
    className={`
      text-sm text-gray-500 py-2
      ${position === 'top' ? 'caption-top' : 'caption-bottom'}
      ${className}
    `}
    data-testid={testId}
    {...props}
  >
    {children}
  </caption>
));

TableCaption.displayName = 'TableCaption';

// ============================================================================
// EMPTY STATE COMPONENT
// ============================================================================

/**
 * Table empty state props
 */
export interface TableEmptyStateProps {
  /** Icon */
  icon?: React.ReactNode;
  /** Title */
  title?: string;
  /** Description */
  description?: string;
  /** Action button */
  action?: React.ReactNode;
  /** Column span */
  colSpan?: number;
  /** Test ID */
  testId?: string;
}

/**
 * Table empty state row
 */
export const TableEmptyState = memo<TableEmptyStateProps>(({
  icon,
  title = 'No data',
  description,
  action,
  colSpan = 1,
  testId = 'table-empty',
}) => (
  <TableRow testId={testId}>
    <TableCell colSpan={colSpan} align="center" className="py-12">
      <div className="flex flex-col items-center text-gray-500">
        {icon && (
          <div className="mb-3 text-gray-400">
            {icon}
          </div>
        )}
        <p className="text-sm font-medium">{title}</p>
        {description && (
          <p className="text-xs mt-1">{description}</p>
        )}
        {action && (
          <div className="mt-4">
            {action}
          </div>
        )}
      </div>
    </TableCell>
  </TableRow>
));

TableEmptyState.displayName = 'TableEmptyState';

// ============================================================================
// LOADING STATE COMPONENT
// ============================================================================

/**
 * Table loading state props
 */
export interface TableLoadingStateProps {
  /** Number of rows to show */
  rows?: number;
  /** Number of columns */
  columns?: number;
  /** Test ID */
  testId?: string;
}

/**
 * Table loading skeleton
 */
export const TableLoadingState = memo<TableLoadingStateProps>(({
  rows = 5,
  columns = 4,
  testId = 'table-loading',
}) => (
  <>
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <TableRow key={rowIndex} testId={`${testId}-row-${rowIndex}`}>
        {Array.from({ length: columns }).map((_, colIndex) => (
          <TableCell key={colIndex} testId={`${testId}-cell-${rowIndex}-${colIndex}`}>
            <div className="h-4 bg-gray-200 rounded animate-pulse" />
          </TableCell>
        ))}
      </TableRow>
    ))}
  </>
));

TableLoadingState.displayName = 'TableLoadingState';

// ============================================================================
// DATA TABLE COMPONENT
// ============================================================================

/**
 * Column definition
 */
export interface ColumnDef<T> {
  /** Column key */
  key: string;
  /** Header label */
  header: React.ReactNode;
  /** Cell renderer */
  cell?: (row: T, index: number) => React.ReactNode;
  /** Accessor function */
  accessor?: (row: T) => React.ReactNode;
  /** Width */
  width?: string | number;
  /** Alignment */
  align?: 'left' | 'center' | 'right';
  /** Sortable */
  sortable?: boolean;
  /** Sort function */
  sortFn?: (a: T, b: T) => number;
  /** Header class */
  headerClassName?: string;
  /** Cell class */
  cellClassName?: string;
}

/**
 * Data table props
 */
export interface DataTableProps<T> {
  /** Data array */
  data: T[];
  /** Column definitions */
  columns: ColumnDef<T>[];
  /** Row key getter */
  getRowKey: (row: T, index: number) => string | number;
  /** Table variant */
  variant?: TableVariant;
  /** Table size */
  size?: TableSize;
  /** Hoverable rows */
  hoverable?: boolean;
  /** Selectable rows */
  selectable?: boolean;
  /** Selected row keys */
  selectedKeys?: Set<string | number>;
  /** Selection handler */
  onSelectionChange?: (keys: Set<string | number>) => void;
  /** Row click handler */
  onRowClick?: (row: T, index: number) => void;
  /** Loading state */
  loading?: boolean;
  /** Empty state */
  emptyState?: React.ReactNode;
  /** Caption */
  caption?: string;
  /** Sticky header */
  stickyHeader?: boolean;
  /** Additional table class */
  className?: string;
  /** Test ID */
  testId?: string;
}

/**
 * Data table with columns and sorting
 */
export function DataTable<T>({
  data,
  columns,
  getRowKey,
  variant = 'default',
  size = 'md',
  hoverable = false,
  selectable = false,
  selectedKeys = new Set(),
  onSelectionChange,
  onRowClick,
  loading = false,
  emptyState,
  caption,
  stickyHeader = false,
  className = '',
  testId = 'data-table',
}: DataTableProps<T>) {
  // Sort state
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  // Handle sort
  const handleSort = useCallback((columnKey: string, sortFn?: (a: T, b: T) => number) => {
    if (sortColumn === columnKey) {
      // Toggle direction
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection(null);
      } else {
        setSortDirection('asc');
      }
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  }, [sortColumn, sortDirection]);

  // Sort data
  const sortedData = React.useMemo(() => {
    if (!sortColumn || !sortDirection) return data;

    const column = columns.find((c) => c.key === sortColumn);
    if (!column?.sortFn) return data;

    const sorted = [...data].sort(column.sortFn);
    return sortDirection === 'desc' ? sorted.reverse() : sorted;
  }, [data, columns, sortColumn, sortDirection]);

  // Handle row selection
  const handleRowSelect = useCallback((key: string | number) => {
    if (!onSelectionChange) return;

    const newSelection = new Set(selectedKeys);
    if (newSelection.has(key)) {
      newSelection.delete(key);
    } else {
      newSelection.add(key);
    }
    onSelectionChange(newSelection);
  }, [selectedKeys, onSelectionChange]);

  // Handle select all
  const handleSelectAll = useCallback(() => {
    if (!onSelectionChange) return;

    if (selectedKeys.size === data.length) {
      onSelectionChange(new Set());
    } else {
      const allKeys = data.map((row, index) => getRowKey(row, index));
      onSelectionChange(new Set(allKeys));
    }
  }, [data, selectedKeys, onSelectionChange, getRowKey]);

  const allSelected = data.length > 0 && selectedKeys.size === data.length;
  const someSelected = selectedKeys.size > 0 && selectedKeys.size < data.length;

  return (
    <Table
      variant={variant}
      size={size}
      hoverable={hoverable}
      stickyHeader={stickyHeader}
      className={className}
      testId={testId}
    >
      {caption && <TableCaption position="top">{caption}</TableCaption>}

      <TableHeader>
        <TableRow>
          {selectable && (
            <TableHead width={40} align="center" testId={`${testId}-select-all`}>
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected;
                }}
                onChange={handleSelectAll}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                aria-label="Select all rows"
              />
            </TableHead>
          )}
          {columns.map((column) => (
            <TableHead
              key={column.key}
              width={column.width}
              align={column.align}
              sortable={column.sortable}
              sortDirection={sortColumn === column.key ? sortDirection : null}
              onSort={column.sortable ? () => handleSort(column.key, column.sortFn) : undefined}
              className={column.headerClassName}
              testId={`${testId}-head-${column.key}`}
            >
              {column.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>

      <TableBody>
        {loading ? (
          <TableLoadingState rows={5} columns={columns.length + (selectable ? 1 : 0)} />
        ) : sortedData.length === 0 ? (
          emptyState ? (
            <TableRow>
              <TableCell colSpan={columns.length + (selectable ? 1 : 0)}>
                {emptyState}
              </TableCell>
            </TableRow>
          ) : (
            <TableEmptyState colSpan={columns.length + (selectable ? 1 : 0)} />
          )
        ) : (
          sortedData.map((row, rowIndex) => {
            const key = getRowKey(row, rowIndex);
            const isSelected = selectedKeys.has(key);

            return (
              <TableRow
                key={key}
                selected={isSelected}
                clickable={!!onRowClick}
                onClick={onRowClick ? () => onRowClick(row, rowIndex) : undefined}
                testId={`${testId}-row-${rowIndex}`}
              >
                {selectable && (
                  <TableCell align="center" testId={`${testId}-select-${rowIndex}`}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleRowSelect(key)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      aria-label={`Select row ${rowIndex + 1}`}
                    />
                  </TableCell>
                )}
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    align={column.align}
                    className={column.cellClassName}
                    testId={`${testId}-cell-${rowIndex}-${column.key}`}
                  >
                    {column.cell
                      ? column.cell(row, rowIndex)
                      : column.accessor
                      ? column.accessor(row)
                      : (row as Record<string, unknown>)[column.key] as React.ReactNode}
                  </TableCell>
                ))}
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}

// ============================================================================
// STEPS TABLE PRESET
// ============================================================================

/**
 * Step data for steps table
 */
export interface StepData {
  id: string;
  name: string;
  event: 'click' | 'input' | 'enter' | 'open' | string;
  label: string;
  path: string;
  value: string;
  status?: 'pending' | 'running' | 'passed' | 'failed';
  duration?: number;
  error_message?: string | null;
}

/**
 * Steps table props
 */
export interface StepsTableProps {
  /** Steps data */
  steps: StepData[];
  /** Editable mode */
  editable?: boolean;
  /** Current step index (for highlighting) */
  currentStepIndex?: number;
  /** Edit handler */
  onEdit?: (index: number, field: string, value: string) => void;
  /** Delete handler */
  onDelete?: (index: number) => void;
  /** Show status column */
  showStatus?: boolean;
  /** Show duration column */
  showDuration?: boolean;
  /** Test ID */
  testId?: string;
}

/**
 * Steps table preset component
 */
export const StepsTable = memo<StepsTableProps>(({
  steps,
  editable = false,
  currentStepIndex,
  onEdit,
  onDelete,
  showStatus = false,
  showDuration = false,
  testId = 'steps-table',
}) => {
  const getStatusBadge = (status?: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-gray-100 text-gray-600',
      running: 'bg-blue-100 text-blue-700',
      passed: 'bg-green-100 text-green-700',
      failed: 'bg-red-100 text-red-700',
    };

    return status ? (
      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${styles[status] || styles.pending}`}>
        {status}
      </span>
    ) : null;
  };

  const getEventBadge = (event: string) => {
    const styles: Record<string, string> = {
      click: 'bg-purple-100 text-purple-700',
      input: 'bg-blue-100 text-blue-700',
      enter: 'bg-green-100 text-green-700',
      open: 'bg-yellow-100 text-yellow-700',
    };

    return (
      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${styles[event] || 'bg-gray-100 text-gray-700'}`}>
        {event}
      </span>
    );
  };

  return (
    <Table variant="bordered" hoverable testId={testId}>
      <TableHeader>
        <TableRow>
          <TableHead width={60} align="center">#</TableHead>
          <TableHead width={80}>Event</TableHead>
          <TableHead>Label</TableHead>
          <TableHead>XPath</TableHead>
          <TableHead>Value</TableHead>
          {showStatus && <TableHead width={100}>Status</TableHead>}
          {showDuration && <TableHead width={80} align="right">Duration</TableHead>}
          {editable && <TableHead width={80} align="center">Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {steps.length === 0 ? (
          <TableEmptyState
            colSpan={5 + (showStatus ? 1 : 0) + (showDuration ? 1 : 0) + (editable ? 1 : 0)}
            title="No steps recorded"
            description="Start recording to capture steps"
          />
        ) : (
          steps.map((step, index) => (
            <TableRow
              key={step.id}
              highlighted={currentStepIndex === index}
              status={step.status === 'passed' ? 'success' : step.status === 'failed' ? 'error' : step.status === 'running' ? 'running' : 'default'}
              testId={`${testId}-row-${index}`}
            >
              <TableCell align="center">{index + 1}</TableCell>
              <TableCell>{getEventBadge(step.event)}</TableCell>
              <TableCell>
                {editable ? (
                  <input
                    type="text"
                    value={step.label}
                    onChange={(e) => onEdit?.(index, 'label', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                ) : (
                  step.label
                )}
              </TableCell>
              <TableCell truncate mono>
                {step.path}
              </TableCell>
              <TableCell>
                {editable ? (
                  <input
                    type="text"
                    value={step.value}
                    onChange={(e) => onEdit?.(index, 'value', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                ) : (
                  step.value || '-'
                )}
              </TableCell>
              {showStatus && <TableCell>{getStatusBadge(step.status)}</TableCell>}
              {showDuration && (
                <TableCell align="right">
                  {step.duration !== undefined ? `${step.duration}ms` : '-'}
                </TableCell>
              )}
              {editable && (
                <TableCell align="center">
                  <button
                    onClick={() => onDelete?.(index)}
                    className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                    aria-label={`Delete step ${index + 1}`}
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </TableCell>
              )}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
});

StepsTable.displayName = 'StepsTable';

// ============================================================================
// HELPER ICON COMPONENTS
// ============================================================================

interface SortIconProps {
  direction: SortDirection;
}

const SortIcon: React.FC<SortIconProps> = ({ direction }) => (
  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    {direction === 'asc' ? (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
    ) : direction === 'desc' ? (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    ) : (
      <>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 15l4 4 4-4" />
      </>
    )}
  </svg>
);

const TrashIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

// ============================================================================
// EXPORTS
// ============================================================================

export default Table;
