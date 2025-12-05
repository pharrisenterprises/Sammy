/**
 * Table Component Tests
 * @module components/Ui/Table.test
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
  TableEmptyState,
  TableLoadingState,
  DataTable,
  StepsTable,
  ColumnDef,
  StepData,
} from './Table';

// ============================================================================
// TABLE TESTS
// ============================================================================

describe('Table', () => {
  describe('Rendering', () => {
    it('should render table with children', () => {
      render(
        <Table testId="my-table">
          <TableBody>
            <TableRow>
              <TableCell>Content</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      );
      expect(screen.getByTestId('my-table')).toBeInTheDocument();
    });

    it('should render with container', () => {
      render(
        <Table testId="my-table">
          <TableBody>
            <TableRow>
              <TableCell>Content</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      );
      expect(screen.getByTestId('my-table-container')).toBeInTheDocument();
    });
  });

  describe('Variants', () => {
    const variants = ['default', 'striped', 'bordered'] as const;

    variants.forEach((variant) => {
      it(`should render ${variant} variant`, () => {
        render(
          <Table variant={variant} testId={`table-${variant}`}>
            <TableBody>
              <TableRow>
                <TableCell>Content</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        );
        expect(screen.getByTestId(`table-${variant}`)).toHaveAttribute('data-variant', variant);
      });
    });
  });

  describe('Sizes', () => {
    const sizes = ['sm', 'md', 'lg'] as const;

    sizes.forEach((size) => {
      it(`should render ${size} size`, () => {
        render(
          <Table size={size} testId="table">
            <TableHeader>
              <TableRow>
                <TableHead testId="head">Header</TableHead>
              </TableRow>
            </TableHeader>
          </Table>
        );
        expect(screen.getByTestId('table')).toBeInTheDocument();
      });
    });
  });

  describe('Fixed Layout', () => {
    it('should render with fixed layout', () => {
      render(
        <Table fixed testId="table">
          <TableBody>
            <TableRow>
              <TableCell>Content</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      );
      expect(screen.getByTestId('table')).toHaveClass('table-fixed');
    });
  });
});

// ============================================================================
// TABLE HEADER TESTS
// ============================================================================

describe('TableHeader', () => {
  it('should render header', () => {
    render(
      <Table>
        <TableHeader testId="header">
          <TableRow>
            <TableHead>Column</TableHead>
          </TableRow>
        </TableHeader>
      </Table>
    );
    expect(screen.getByTestId('header')).toBeInTheDocument();
  });
});

// ============================================================================
// TABLE BODY TESTS
// ============================================================================

describe('TableBody', () => {
  it('should render body', () => {
    render(
      <Table>
        <TableBody testId="body">
          <TableRow>
            <TableCell>Content</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
    expect(screen.getByTestId('body')).toBeInTheDocument();
  });
});

// ============================================================================
// TABLE FOOTER TESTS
// ============================================================================

describe('TableFooter', () => {
  it('should render footer', () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Content</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter testId="footer">
          <TableRow>
            <TableCell>Footer</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    );
    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });
});

// ============================================================================
// TABLE ROW TESTS
// ============================================================================

describe('TableRow', () => {
  it('should render row', () => {
    render(
      <Table>
        <TableBody>
          <TableRow testId="row">
            <TableCell>Content</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
    expect(screen.getByTestId('row')).toBeInTheDocument();
  });

  it('should render selected row', () => {
    render(
      <Table>
        <TableBody>
          <TableRow selected testId="row">
            <TableCell>Content</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
    expect(screen.getByTestId('row')).toHaveAttribute('data-selected', 'true');
    expect(screen.getByTestId('row')).toHaveClass('bg-blue-50');
  });

  it('should render highlighted row', () => {
    render(
      <Table>
        <TableBody>
          <TableRow highlighted testId="row">
            <TableCell>Content</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
    expect(screen.getByTestId('row')).toHaveAttribute('data-highlighted', 'true');
  });

  it('should render row with status', () => {
    render(
      <Table>
        <TableBody>
          <TableRow status="success" testId="row">
            <TableCell>Content</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
    expect(screen.getByTestId('row')).toHaveAttribute('data-status', 'success');
    expect(screen.getByTestId('row')).toHaveClass('bg-green-50');
  });

  it('should call onClick', async () => {
    const onClick = vi.fn();
    render(
      <Table>
        <TableBody>
          <TableRow onClick={onClick} testId="row">
            <TableCell>Content</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );

    await userEvent.click(screen.getByTestId('row'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('should not call onClick when disabled', async () => {
    const onClick = vi.fn();
    render(
      <Table>
        <TableBody>
          <TableRow disabled onClick={onClick} testId="row">
            <TableCell>Content</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );

    await userEvent.click(screen.getByTestId('row'));
    expect(onClick).not.toHaveBeenCalled();
  });
});

// ============================================================================
// TABLE HEAD TESTS
// ============================================================================

describe('TableHead', () => {
  it('should render header cell', () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead testId="head">Column</TableHead>
          </TableRow>
        </TableHeader>
      </Table>
    );
    expect(screen.getByTestId('head')).toHaveTextContent('Column');
  });

  it('should render sortable header', () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead sortable testId="head">Column</TableHead>
          </TableRow>
        </TableHeader>
      </Table>
    );
    expect(screen.getByTestId('head')).toHaveAttribute('data-sortable', 'true');
    expect(screen.getByTestId('head')).toHaveClass('cursor-pointer');
  });

  it('should call onSort when clicked', async () => {
    const onSort = vi.fn();
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead sortable onSort={onSort} testId="head">Column</TableHead>
          </TableRow>
        </TableHeader>
      </Table>
    );

    await userEvent.click(screen.getByTestId('head'));
    expect(onSort).toHaveBeenCalledTimes(1);
  });

  it('should show sort direction', () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead sortable sortDirection="asc" testId="head">Column</TableHead>
          </TableRow>
        </TableHeader>
      </Table>
    );
    expect(screen.getByTestId('head')).toHaveAttribute('aria-sort', 'ascending');
  });

  it('should render with alignment', () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead align="right" testId="head">Column</TableHead>
          </TableRow>
        </TableHeader>
      </Table>
    );
    expect(screen.getByTestId('head')).toHaveClass('text-right');
  });
});

// ============================================================================
// TABLE CELL TESTS
// ============================================================================

describe('TableCell', () => {
  it('should render cell', () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell testId="cell">Content</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
    expect(screen.getByTestId('cell')).toHaveTextContent('Content');
  });

  it('should render with alignment', () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell align="center" testId="cell">Content</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
    expect(screen.getByTestId('cell')).toHaveClass('text-center');
  });

  it('should render with truncate', () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell truncate testId="cell">Long content</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
    expect(screen.getByTestId('cell')).toHaveClass('truncate');
  });

  it('should render with mono font', () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell mono testId="cell">Code</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
    expect(screen.getByTestId('cell')).toHaveClass('font-mono');
  });
});

// ============================================================================
// TABLE CAPTION TESTS
// ============================================================================

describe('TableCaption', () => {
  it('should render caption', () => {
    render(
      <Table>
        <TableCaption testId="caption">Table title</TableCaption>
        <TableBody>
          <TableRow>
            <TableCell>Content</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
    expect(screen.getByTestId('caption')).toHaveTextContent('Table title');
  });

  it('should position caption at top', () => {
    render(
      <Table>
        <TableCaption position="top" testId="caption">Title</TableCaption>
        <TableBody>
          <TableRow>
            <TableCell>Content</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
    expect(screen.getByTestId('caption')).toHaveClass('caption-top');
  });
});

// ============================================================================
// EMPTY STATE TESTS
// ============================================================================

describe('TableEmptyState', () => {
  it('should render empty state', () => {
    render(
      <Table>
        <TableBody>
          <TableEmptyState title="No data" colSpan={3} testId="empty" />
        </TableBody>
      </Table>
    );
    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  it('should render with description', () => {
    render(
      <Table>
        <TableBody>
          <TableEmptyState title="No data" description="Add some data" colSpan={3} />
        </TableBody>
      </Table>
    );
    expect(screen.getByText('Add some data')).toBeInTheDocument();
  });

  it('should render with action', () => {
    render(
      <Table>
        <TableBody>
          <TableEmptyState
            title="No data"
            action={<button>Add</button>}
            colSpan={3}
          />
        </TableBody>
      </Table>
    );
    expect(screen.getByRole('button')).toHaveTextContent('Add');
  });
});

// ============================================================================
// LOADING STATE TESTS
// ============================================================================

describe('TableLoadingState', () => {
  it('should render loading skeletons', () => {
    render(
      <Table>
        <TableBody>
          <TableLoadingState rows={3} columns={4} testId="loading" />
        </TableBody>
      </Table>
    );
    expect(screen.getByTestId('loading-row-0')).toBeInTheDocument();
    expect(screen.getByTestId('loading-row-1')).toBeInTheDocument();
    expect(screen.getByTestId('loading-row-2')).toBeInTheDocument();
  });
});

// ============================================================================
// DATA TABLE TESTS
// ============================================================================

describe('DataTable', () => {
  interface TestData {
    id: number;
    name: string;
    email: string;
  }

  const testData: TestData[] = [
    { id: 1, name: 'Alice', email: 'alice@example.com' },
    { id: 2, name: 'Bob', email: 'bob@example.com' },
    { id: 3, name: 'Charlie', email: 'charlie@example.com' },
  ];

  const columns: ColumnDef<TestData>[] = [
    { key: 'id', header: 'ID', width: 60 },
    { key: 'name', header: 'Name' },
    { key: 'email', header: 'Email' },
  ];

  it('should render data table', () => {
    render(
      <DataTable
        data={testData}
        columns={columns}
        getRowKey={(row) => row.id}
        testId="data-table"
      />
    );
    expect(screen.getByTestId('data-table')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('should render empty state', () => {
    render(
      <DataTable
        data={[]}
        columns={columns}
        getRowKey={(row) => row.id}
        testId="data-table"
      />
    );
    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  it('should render loading state', () => {
    render(
      <DataTable
        data={[]}
        columns={columns}
        getRowKey={(row) => row.id}
        loading
        testId="data-table"
      />
    );
    expect(screen.getByTestId('table-loading-row-0')).toBeInTheDocument();
  });

  it('should handle row click', async () => {
    const onRowClick = vi.fn();
    render(
      <DataTable
        data={testData}
        columns={columns}
        getRowKey={(row) => row.id}
        onRowClick={onRowClick}
        testId="data-table"
      />
    );

    await userEvent.click(screen.getByTestId('data-table-row-0'));
    expect(onRowClick).toHaveBeenCalledWith(testData[0], 0);
  });

  it('should handle row selection', async () => {
    const onSelectionChange = vi.fn();
    render(
      <DataTable
        data={testData}
        columns={columns}
        getRowKey={(row) => row.id}
        selectable
        selectedKeys={new Set()}
        onSelectionChange={onSelectionChange}
        testId="data-table"
      />
    );

    // Click checkbox for first row
    const checkbox = screen.getByTestId('data-table-select-0').querySelector('input');
    await userEvent.click(checkbox!);

    expect(onSelectionChange).toHaveBeenCalled();
  });

  it('should handle select all', async () => {
    const onSelectionChange = vi.fn();
    render(
      <DataTable
        data={testData}
        columns={columns}
        getRowKey={(row) => row.id}
        selectable
        selectedKeys={new Set()}
        onSelectionChange={onSelectionChange}
        testId="data-table"
      />
    );

    const selectAllCheckbox = screen.getByTestId('data-table-select-all').querySelector('input');
    await userEvent.click(selectAllCheckbox!);

    expect(onSelectionChange).toHaveBeenCalledWith(new Set([1, 2, 3]));
  });

  it('should handle sorting', async () => {
    const sortableColumns: ColumnDef<TestData>[] = [
      { key: 'id', header: 'ID', sortable: true, sortFn: (a, b) => a.id - b.id },
      { key: 'name', header: 'Name', sortable: true, sortFn: (a, b) => a.name.localeCompare(b.name) },
    ];

    render(
      <DataTable
        data={testData}
        columns={sortableColumns}
        getRowKey={(row) => row.id}
        testId="data-table"
      />
    );

    // Click to sort by name
    await userEvent.click(screen.getByTestId('data-table-head-name'));
    
    // Verify sort direction is set
    expect(screen.getByTestId('data-table-head-name')).toHaveAttribute('aria-sort', 'ascending');
  });
});

// ============================================================================
// STEPS TABLE TESTS
// ============================================================================

describe('StepsTable', () => {
  const steps: StepData[] = [
    { id: '1', name: 'Step 1', event: 'click', label: 'Login Button', path: '/html/body/button', value: '' },
    { id: '2', name: 'Step 2', event: 'input', label: 'Username', path: '/html/body/input[1]', value: 'testuser' },
    { id: '3', name: 'Step 3', event: 'input', label: 'Password', path: '/html/body/input[2]', value: 'secret' },
  ];

  it('should render steps table', () => {
    render(<StepsTable steps={steps} testId="steps-table" />);
    expect(screen.getByTestId('steps-table')).toBeInTheDocument();
    expect(screen.getByText('Login Button')).toBeInTheDocument();
  });

  it('should render empty state', () => {
    render(<StepsTable steps={[]} testId="steps-table" />);
    expect(screen.getByText('No steps recorded')).toBeInTheDocument();
  });

  it('should highlight current step', () => {
    render(<StepsTable steps={steps} currentStepIndex={1} testId="steps-table" />);
    expect(screen.getByTestId('steps-table-row-1')).toHaveAttribute('data-highlighted', 'true');
  });

  it('should show status column', () => {
    const stepsWithStatus = steps.map((s, i) => ({
      ...s,
      status: i === 0 ? 'passed' : 'pending' as const,
    }));

    render(<StepsTable steps={stepsWithStatus} showStatus testId="steps-table" />);
    expect(screen.getByText('passed')).toBeInTheDocument();
  });

  it('should show duration column', () => {
    const stepsWithDuration = steps.map((s, i) => ({
      ...s,
      duration: (i + 1) * 100,
    }));

    render(<StepsTable steps={stepsWithDuration} showDuration testId="steps-table" />);
    expect(screen.getByText('100ms')).toBeInTheDocument();
  });

  it('should render editable inputs', () => {
    render(<StepsTable steps={steps} editable testId="steps-table" />);
    
    // Should have input fields
    const inputs = screen.getAllByRole('textbox');
    expect(inputs.length).toBeGreaterThan(0);
  });

  it('should call onEdit', async () => {
    const onEdit = vi.fn();
    render(<StepsTable steps={steps} editable onEdit={onEdit} testId="steps-table" />);
    
    const inputs = screen.getAllByRole('textbox');
    await userEvent.clear(inputs[0]);
    await userEvent.type(inputs[0], 'New Label');
    
    expect(onEdit).toHaveBeenCalled();
  });

  it('should call onDelete', async () => {
    const onDelete = vi.fn();
    render(<StepsTable steps={steps} editable onDelete={onDelete} testId="steps-table" />);
    
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    await userEvent.click(deleteButtons[0]);
    
    expect(onDelete).toHaveBeenCalledWith(0);
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('Edge Cases', () => {
  it('should forward refs', () => {
    const tableRef = React.createRef<HTMLTableElement>();
    
    render(
      <Table ref={tableRef} testId="table">
        <TableBody>
          <TableRow>
            <TableCell>Content</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
    
    expect(tableRef.current).toBe(screen.getByTestId('table'));
  });

  it('should handle className prop', () => {
    render(
      <Table className="custom-class" testId="table">
        <TableBody>
          <TableRow>
            <TableCell>Content</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
    expect(screen.getByTestId('table')).toHaveClass('custom-class');
  });

  it('should handle colspan', () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell colSpan={3} testId="cell">Spanning cell</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
    expect(screen.getByTestId('cell')).toHaveAttribute('colspan', '3');
  });
});
