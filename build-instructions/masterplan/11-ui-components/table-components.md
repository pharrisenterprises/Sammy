# Table Components
**Project:** Chrome Extension Test Recorder - UI Components  
**Document Version:** 1.0  
**Last Updated:** November 25, 2025  
**Status:** Complete Technical Specification

## Table of Contents
1. Overview
2. Base Table Component
3. Data Table Pattern
4. Sortable Headers
5. Pagination
6. Selection
7. Empty States
8. Loading States
9. Responsive Tables
10. Testing Strategy

---

## 1. Overview

### 1.1 Purpose

Table components display structured data in rows and columns with support for sorting, pagination, selection, and responsive layouts.

### 1.2 File Location
```
src/components/ui/
├── table.tsx
└── data-table/
    ├── data-table.tsx
    ├── data-table-pagination.tsx
    └── data-table-toolbar.tsx
```

### 1.3 Features

- Semantic HTML table elements
- Sortable columns
- Row selection
- Pagination controls
- Empty and loading states
- Responsive scrolling

---

## 2. Base Table Component

### 2.1 Table Implementation
```typescript
// src/components/ui/table.tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    <table
      ref={ref}
      className={cn('w-full caption-bottom text-sm', className)}
      {...props}
    />
  </div>
));
Table.displayName = 'Table';

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn('[&_tr]:border-b', className)} {...props} />
));
TableHeader.displayName = 'TableHeader';

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn('[&_tr:last-child]:border-0', className)}
    {...props}
  />
));
TableBody.displayName = 'TableBody';

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      'border-t bg-muted/50 font-medium [&>tr]:last:border-b-0',
      className
    )}
    {...props}
  />
));
TableFooter.displayName = 'TableFooter';

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      'border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted',
      className
    )}
    {...props}
  />
));
TableRow.displayName = 'TableRow';

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      'h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0',
      className
    )}
    {...props}
  />
));
TableHead.displayName = 'TableHead';

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn('p-4 align-middle [&:has([role=checkbox])]:pr-0', className)}
    {...props}
  />
));
TableCell.displayName = 'TableCell';

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn('mt-4 text-sm text-muted-foreground', className)}
    {...props}
  />
));
TableCaption.displayName = 'TableCaption';

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption
};
```

### 2.2 Basic Usage
```typescript
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead>Status</TableHead>
      <TableHead>Steps</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {projects.map((project) => (
      <TableRow key={project.id}>
        <TableCell>{project.name}</TableCell>
        <TableCell>
          <Badge variant={project.status === 'complete' ? 'success' : 'default'}>
            {project.status}
          </Badge>
        </TableCell>
        <TableCell>{project.step_count}</TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

---

## 3. Data Table Pattern

### 3.1 Data Table Component
```typescript
// src/components/ui/data-table/data-table.tsx
interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  pageSize?: number;
  selectable?: boolean;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}

interface Column<T> {
  key: keyof T | string;
  header: string;
  sortable?: boolean;
  width?: string;
  render?: (value: any, row: T) => React.ReactNode;
}

export function DataTable<T extends { id: string | number }>({
  data,
  columns,
  pageSize = 10,
  selectable = false,
  onRowClick,
  emptyMessage = 'No data available'
}: DataTableProps<T>) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRows, setSelectedRows] = useState<Set<string | number>>(new Set());

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortColumn) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortColumn as keyof T];
      const bVal = b[sortColumn as keyof T];

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortColumn, sortDirection]);

  // Paginate data
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const totalPages = Math.ceil(data.length / pageSize);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRows(new Set(paginatedData.map(row => row.id)));
    } else {
      setSelectedRows(new Set());
    }
  };

  const handleSelectRow = (id: string | number, checked: boolean) => {
    const newSelected = new Set(selectedRows);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedRows(newSelected);
  };

  if (data.length === 0) {
    return <EmptyState message={emptyMessage} />;
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            {selectable && (
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedRows.size === paginatedData.length}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all"
                />
              </TableHead>
            )}
            {columns.map((column) => (
              <TableHead key={String(column.key)} style={{ width: column.width }}>
                {column.sortable ? (
                  <SortableHeader
                    label={column.header}
                    active={sortColumn === column.key}
                    direction={sortDirection}
                    onSort={() => handleSort(String(column.key))}
                  />
                ) : (
                  column.header
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedData.map((row) => (
            <TableRow
              key={row.id}
              onClick={() => onRowClick?.(row)}
              className={onRowClick ? 'cursor-pointer' : ''}
              data-state={selectedRows.has(row.id) ? 'selected' : undefined}
            >
              {selectable && (
                <TableCell>
                  <Checkbox
                    checked={selectedRows.has(row.id)}
                    onCheckedChange={(checked) => 
                      handleSelectRow(row.id, checked as boolean)
                    }
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Select row ${row.id}`}
                  />
                </TableCell>
              )}
              {columns.map((column) => (
                <TableCell key={String(column.key)}>
                  {column.render
                    ? column.render(row[column.key as keyof T], row)
                    : String(row[column.key as keyof T] ?? '')}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
}
```

---

## 4. Sortable Headers

### 4.1 Sortable Header Component
```typescript
interface SortableHeaderProps {
  label: string;
  active: boolean;
  direction: 'asc' | 'desc';
  onSort: () => void;
}

function SortableHeader({
  label,
  active,
  direction,
  onSort
}: SortableHeaderProps) {
  return (
    <button
      onClick={onSort}
      className="flex items-center gap-2 hover:text-foreground transition-colors"
    >
      {label}
      <div className="w-4 h-4">
        {active ? (
          direction === 'asc' ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )
        ) : (
          <ChevronsUpDown className="w-4 h-4 opacity-30" />
        )}
      </div>
    </button>
  );
}
```

---

## 5. Pagination

### 5.1 Pagination Component
```typescript
// src/components/ui/data-table/data-table-pagination.tsx
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange
}: PaginationProps) {
  const pages = useMemo(() => {
    const items: (number | 'ellipsis')[] = [];

    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    items.push(1);

    if (currentPage > 3) {
      items.push('ellipsis');
    }

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    for (let i = start; i <= end; i++) {
      items.push(i);
    }

    if (currentPage < totalPages - 2) {
      items.push('ellipsis');
    }

    items.push(totalPages);

    return items;
  }, [currentPage, totalPages]);

  return (
    <div className="flex items-center justify-between px-2">
      <p className="text-sm text-muted-foreground">
        Page {currentPage} of {totalPages}
      </p>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {pages.map((page, index) => (
          page === 'ellipsis' ? (
            <span key={`ellipsis-${index}`} className="px-2 text-muted-foreground">
              ...
            </span>
          ) : (
            <Button
              key={page}
              variant={page === currentPage ? 'default' : 'outline'}
              size="sm"
              onClick={() => onPageChange(page)}
              aria-current={page === currentPage ? 'page' : undefined}
            >
              {page}
            </Button>
          )
        ))}

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
```

---

## 6. Selection

### 6.1 Selection Hook
```typescript
function useTableSelection<T extends { id: string | number }>(
  data: T[]
) {
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(
    new Set()
  );

  const isSelected = (id: string | number) => selectedIds.has(id);

  const isAllSelected = data.length > 0 && selectedIds.size === data.length;

  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < data.length;

  const toggleRow = (id: string | number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data.map(item => item.id)));
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const selectedRows = data.filter(item => selectedIds.has(item.id));

  return {
    selectedIds,
    selectedRows,
    isSelected,
    isAllSelected,
    isSomeSelected,
    toggleRow,
    toggleAll,
    clearSelection
  };
}
```

### 6.2 Selection Toolbar
```typescript
interface SelectionToolbarProps {
  selectedCount: number;
  onDelete: () => void;
  onExport: () => void;
  onClear: () => void;
}

function SelectionToolbar({
  selectedCount,
  onDelete,
  onExport,
  onClear
}: SelectionToolbarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
      <p className="text-sm font-medium">
        {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
      </p>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onExport}>
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
        <Button variant="destructive" size="sm" onClick={onDelete}>
          <Trash2 className="w-4 h-4 mr-2" />
          Delete
        </Button>
        <Button variant="ghost" size="sm" onClick={onClear}>
          Clear
        </Button>
      </div>
    </div>
  );
}
```

---

## 7. Empty States

### 7.1 Empty State Component
```typescript
interface EmptyStateProps {
  icon?: React.ReactNode;
  title?: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

function EmptyState({
  icon,
  title,
  message,
  action
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {icon || (
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <FileX className="w-8 h-8 text-muted-foreground" />
        </div>
      )}

      {title && (
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {title}
        </h3>
      )}

      <p className="text-sm text-muted-foreground mb-4 max-w-md">
        {message}
      </p>

      {action && (
        <Button onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
```

### 7.2 Empty State Usage
```typescript
// No data
<EmptyState message="No projects found" />

// No search results
<EmptyState
  icon={<Search className="w-8 h-8 text-muted-foreground" />}
  title="No results"
  message="Try adjusting your search or filters"
/>
```

---

## 8. Loading States

### 8.1 Table Skeleton
```typescript
interface TableSkeletonProps {
  columns: number;
  rows?: number;
}

function TableSkeleton({ columns, rows = 5 }: TableSkeletonProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {Array.from({ length: columns }).map((_, i) => (
            <TableHead key={i}>
              <Skeleton className="h-4 w-24" />
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <TableRow key={rowIndex}>
            {Array.from({ length: columns }).map((_, colIndex) => (
              <TableCell key={colIndex}>
                <Skeleton className="h-4 w-full" />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

### 8.2 Loading State Usage
```typescript
function ProjectsTable() {
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  if (isLoading) {
    return <TableSkeleton columns={3} rows={5} />;
  }

  return <DataTable data={projects} columns={columns} />;
}
```

---

## 9. Responsive Tables

### 9.1 Responsive Pattern
```typescript
// Horizontal scroll wrapper (default)
<div className="overflow-x-auto">
  <Table>
    {/* ... */}
  </Table>
</div>

// Card-based mobile view
function ResponsiveTable<T>({
  data,
  columns,
  renderMobileCard
}: ResponsiveTableProps<T>) {
  return (
    <>
      {/* Desktop: Table */}
      <div className="hidden md:block">
        <DataTable data={data} columns={columns} />
      </div>

      {/* Mobile: Cards */}
      <div className="md:hidden space-y-4">
        {data.map((row, index) => (
          <Card key={index}>
            {renderMobileCard(row)}
          </Card>
        ))}
      </div>
    </>
  );
}
```

### 9.2 Mobile Card Pattern
```typescript
// Usage for steps table
<ResponsiveTable
  data={steps}
  columns={columns}
  renderMobileCard={(step) => (
    <CardContent className="p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium">{step.label}</span>
        <Badge>{step.event}</Badge>
      </div>
      <p className="text-xs text-muted-foreground truncate">
        {step.path}
      </p>
    </CardContent>
  )}
/>
```

---

## 10. Testing Strategy

### 10.1 Component Tests
```typescript
describe('DataTable', () => {
  const mockData = [
    { id: '1', name: 'Project A', status: 'draft' },
    { id: '2', name: 'Project B', status: 'complete' }
  ];

  const columns = [
    { key: 'name', header: 'Name', sortable: true },
    { key: 'status', header: 'Status' }
  ];

  it('renders data in rows', () => {
    render(<DataTable data={mockData} columns={columns} />);

    expect(screen.getByText('Project A')).toBeInTheDocument();
    expect(screen.getByText('Project B')).toBeInTheDocument();
  });

  it('sorts by column when header clicked', async () => {
    render(<DataTable data={mockData} columns={columns} />);

    fireEvent.click(screen.getByText('Name'));

    const rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Project A');
  });

  it('shows empty state when no data', () => {
    render(<DataTable data={[]} columns={columns} />);

    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('paginates data', () => {
    const manyItems = Array.from({ length: 25 }, (_, i) => ({
      id: String(i),
      name: `Project ${i}`,
      status: 'draft'
    }));

    render(<DataTable data={manyItems} columns={columns} pageSize={10} />);

    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
  });
});
```

---

## Summary

Table Components provide:
- ✅ **Base Table** with semantic HTML elements
- ✅ **DataTable** pattern with generic typing
- ✅ **Sortable headers** with direction indicators
- ✅ **Pagination** with ellipsis for many pages
- ✅ **Row selection** with select all
- ✅ **Selection toolbar** for bulk actions
- ✅ **Empty states** with optional actions
- ✅ **Loading states** with skeleton rows
- ✅ **Responsive tables** with mobile card pattern
- ✅ **Testing strategy** for sorting, pagination, selection

Provides flexible, accessible data display.
