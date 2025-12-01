/**
 * StepList Test Suite
 * @module ui/components/StepList.test
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import {
  StepList,
  STEP_ICONS,
  STEP_COLORS,
  STEP_STATUS,
  STATUS_COLORS,
  type StepListItem,
} from './StepList';

// Extend expect with jest-dom matchers
expect.extend(matchers);

// ============================================================================
// MOCK DATA
// ============================================================================

function createMockStep(overrides: Partial<StepListItem> = {}): StepListItem {
  return {
    id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    type: 'click',
    timestamp: Date.now(),
    target: {
      tagName: 'BUTTON',
      xpath: '/html/body/button',
      cssSelector: 'button.submit',
      id: 'submit-btn',
    },
    ...overrides,
  };
}

function createMockSteps(count: number): StepListItem[] {
  const types: StepListItem['type'][] = ['click', 'input', 'navigate', 'assert'];
  return Array.from({ length: count }, (_, i) =>
    createMockStep({
      id: `step-${i}`,
      type: types[i % types.length],
      description: `Step ${i + 1} description`,
    })
  );
}

// ============================================================================
// CONSTANT TESTS
// ============================================================================

describe('StepList constants', () => {
  afterEach(() => {
    cleanup();
  });
  
  it('should have step icons for all types', () => {
    expect(STEP_ICONS.click).toBeDefined();
    expect(STEP_ICONS.input).toBeDefined();
    expect(STEP_ICONS.navigate).toBeDefined();
  });
  
  it('should have step colors for all types', () => {
    expect(STEP_COLORS.click).toBeDefined();
    expect(STEP_COLORS.input).toBeDefined();
    expect(STEP_COLORS.navigate).toBeDefined();
  });
  
  it('should have status values', () => {
    expect(STEP_STATUS.PENDING).toBe('pending');
    expect(STEP_STATUS.PASSED).toBe('passed');
    expect(STEP_STATUS.FAILED).toBe('failed');
  });
  
  it('should have status colors', () => {
    expect(STATUS_COLORS.passed).toBeDefined();
    expect(STATUS_COLORS.failed).toBeDefined();
  });
});

// ============================================================================
// RENDER TESTS
// ============================================================================

describe('StepList rendering', () => {
  afterEach(() => {
    cleanup();
  });
  
  it('should render step list', () => {
    const steps = createMockSteps(3);
    render(<StepList steps={steps} />);
    
    expect(screen.getByTestId('step-list')).toBeInTheDocument();
  });
  
  it('should render all steps', () => {
    const steps = createMockSteps(5);
    render(<StepList steps={steps} />);
    
    for (let i = 0; i < 5; i++) {
      expect(screen.getByTestId(`step-item-${i}`)).toBeInTheDocument();
    }
  });
  
  it('should render step numbers', () => {
    const steps = createMockSteps(3);
    render(<StepList steps={steps} showNumbers />);
    
    expect(screen.getAllByTestId('step-number')).toHaveLength(3);
  });
  
  it('should hide step numbers when showNumbers is false', () => {
    const steps = createMockSteps(3);
    render(<StepList steps={steps} showNumbers={false} />);
    
    expect(screen.queryByTestId('step-number')).not.toBeInTheDocument();
  });
  
  it('should render step icons', () => {
    const steps = createMockSteps(3);
    render(<StepList steps={steps} />);
    
    expect(screen.getAllByTestId('step-icon')).toHaveLength(3);
  });
});

// ============================================================================
// EMPTY STATE TESTS
// ============================================================================

describe('StepList empty state', () => {
  afterEach(() => {
    cleanup();
  });
  
  it('should render empty state when no steps', () => {
    render(<StepList steps={[]} />);
    
    expect(screen.getByTestId('step-list-empty')).toBeInTheDocument();
  });
  
  it('should show default empty message', () => {
    render(<StepList steps={[]} />);
    
    expect(screen.getByText(/No steps recorded/)).toBeInTheDocument();
  });
  
  it('should show custom empty message', () => {
    render(<StepList steps={[]} emptyMessage="Custom empty message" />);
    
    expect(screen.getByText('Custom empty message')).toBeInTheDocument();
  });
});

// ============================================================================
// SELECTION TESTS
// ============================================================================

describe('StepList selection', () => {
  afterEach(() => {
    cleanup();
  });
  
  it('should highlight selected step', () => {
    const steps = createMockSteps(3);
    const { getByTestId } = render(<StepList steps={steps} selectedIds={[steps[1].id]} />);
    
    const selectedItem = getByTestId('step-item-1');
    expect(selectedItem).toHaveAttribute('aria-selected', 'true');
  });
  
  it('should call onSelectionChange on click', () => {
    const steps = createMockSteps(3);
    const onSelectionChange = vi.fn();
    
    render(<StepList steps={steps} onSelectionChange={onSelectionChange} />);
    
    fireEvent.click(screen.getByTestId('step-item-1'));
    
    expect(onSelectionChange).toHaveBeenCalledWith([steps[1].id]);
  });
  
  it('should support multi-select with ctrl+click', () => {
    const steps = createMockSteps(3);
    const onSelectionChange = vi.fn();
    
    render(
      <StepList
        steps={steps}
        selectedIds={[steps[0].id]}
        multiSelect
        onSelectionChange={onSelectionChange}
      />
    );
    
    fireEvent.click(screen.getByTestId('step-item-2'), { ctrlKey: true });
    
    expect(onSelectionChange).toHaveBeenCalledWith([steps[0].id, steps[2].id]);
  });
  
  it('should toggle selection on ctrl+click of selected item', () => {
    const steps = createMockSteps(3);
    const onSelectionChange = vi.fn();
    
    render(
      <StepList
        steps={steps}
        selectedIds={[steps[0].id, steps[1].id]}
        multiSelect
        onSelectionChange={onSelectionChange}
      />
    );
    
    fireEvent.click(screen.getByTestId('step-item-0'), { ctrlKey: true });
    
    expect(onSelectionChange).toHaveBeenCalledWith([steps[1].id]);
  });
});

// ============================================================================
// CURRENT STEP TESTS
// ============================================================================

describe('StepList current step', () => {
  afterEach(() => {
    cleanup();
  });
  
  it('should highlight current step', () => {
    const steps = createMockSteps(3);
    render(<StepList steps={steps} currentStepIndex={1} />);
    
    const currentItem = screen.getByTestId('step-item-1');
    expect(currentItem).toBeInTheDocument();
  });
});

// ============================================================================
// STATUS TESTS
// ============================================================================

describe('StepList status', () => {
  afterEach(() => {
    cleanup();
  });
  
  it('should show status indicator', () => {
    const steps = [
      createMockStep({ id: 'step-0', status: 'passed' }),
      createMockStep({ id: 'step-1', status: 'failed' }),
    ];
    
    render(<StepList steps={steps} showStatus />);
    
    expect(screen.getAllByTestId('step-status')).toHaveLength(2);
  });
  
  it('should hide status indicator when showStatus is false', () => {
    const steps = [createMockStep({ status: 'passed' })];
    
    render(<StepList steps={steps} showStatus={false} />);
    
    expect(screen.queryByTestId('step-status')).not.toBeInTheDocument();
  });
});

// ============================================================================
// DURATION TESTS
// ============================================================================

describe('StepList duration', () => {
  afterEach(() => {
    cleanup();
  });
  
  it('should show duration', () => {
    const steps = [createMockStep({ duration: 1500 })];
    
    render(<StepList steps={steps} showDuration />);
    
    expect(screen.getByTestId('step-duration')).toBeInTheDocument();
    expect(screen.getByText('1.5s')).toBeInTheDocument();
  });
  
  it('should format short durations in ms', () => {
    const steps = [createMockStep({ duration: 500 })];
    
    render(<StepList steps={steps} showDuration />);
    
    expect(screen.getByText('500ms')).toBeInTheDocument();
  });
});

// ============================================================================
// CLICK HANDLER TESTS
// ============================================================================

describe('StepList click handlers', () => {
  afterEach(() => {
    cleanup();
  });
  
  it('should call onStepClick', () => {
    const steps = createMockSteps(3);
    const onStepClick = vi.fn();
    
    render(<StepList steps={steps} onStepClick={onStepClick} />);
    
    fireEvent.click(screen.getByTestId('step-item-1'));
    
    expect(onStepClick).toHaveBeenCalledWith(steps[1], 1);
  });
  
  it('should call onStepDoubleClick', () => {
    const steps = createMockSteps(3);
    const onStepDoubleClick = vi.fn();
    
    render(<StepList steps={steps} onStepDoubleClick={onStepDoubleClick} />);
    
    fireEvent.doubleClick(screen.getByTestId('step-item-1'));
    
    expect(onStepDoubleClick).toHaveBeenCalledWith(steps[1], 1);
  });
});

// ============================================================================
// CONTEXT MENU TESTS
// ============================================================================

describe('StepList context menu', () => {
  afterEach(() => {
    cleanup();
  });
  
  it('should show context menu on right click', () => {
    const steps = createMockSteps(3);
    
    render(
      <StepList
        steps={steps}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    
    fireEvent.contextMenu(screen.getByTestId('step-item-1'));
    
    expect(screen.getByTestId('context-menu')).toBeInTheDocument();
  });
  
  it('should show edit option', () => {
    const steps = createMockSteps(3);
    const onEdit = vi.fn();
    
    render(<StepList steps={steps} onEdit={onEdit} />);
    
    fireEvent.contextMenu(screen.getByTestId('step-item-1'));
    
    expect(screen.getByTestId('menu-edit')).toBeInTheDocument();
  });
  
  it('should call onEdit when edit clicked', () => {
    const steps = createMockSteps(3);
    const onEdit = vi.fn();
    
    render(<StepList steps={steps} onEdit={onEdit} />);
    
    fireEvent.contextMenu(screen.getByTestId('step-item-1'));
    fireEvent.click(screen.getByTestId('menu-edit'));
    
    expect(onEdit).toHaveBeenCalledWith(steps[1], 1);
  });
  
  it('should call onDelete when delete clicked', () => {
    const steps = createMockSteps(3);
    const onDelete = vi.fn();
    
    render(<StepList steps={steps} onDelete={onDelete} />);
    
    fireEvent.contextMenu(screen.getByTestId('step-item-1'));
    fireEvent.click(screen.getByTestId('menu-delete'));
    
    expect(onDelete).toHaveBeenCalledWith(steps[1], 1);
  });
  
  it('should call onDuplicate when duplicate clicked', () => {
    const steps = createMockSteps(3);
    const onDuplicate = vi.fn();
    
    render(<StepList steps={steps} onDuplicate={onDuplicate} />);
    
    fireEvent.contextMenu(screen.getByTestId('step-item-1'));
    fireEvent.click(screen.getByTestId('menu-duplicate'));
    
    expect(onDuplicate).toHaveBeenCalledWith(steps[1], 1);
  });
  
  it('should not show actions in read-only mode', () => {
    const steps = createMockSteps(3);
    
    render(
      <StepList
        steps={steps}
        readOnly
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    
    fireEvent.contextMenu(screen.getByTestId('step-item-1'));
    
    expect(screen.queryByTestId('menu-edit')).not.toBeInTheDocument();
    expect(screen.queryByTestId('menu-delete')).not.toBeInTheDocument();
  });
});

// ============================================================================
// DRAG AND DROP TESTS
// ============================================================================

describe('StepList drag and drop', () => {
  afterEach(() => {
    cleanup();
  });
  
  it('should show drag handle when enableReorder is true', () => {
    const steps = createMockSteps(3);
    
    render(<StepList steps={steps} enableReorder />);
    
    expect(screen.getAllByTestId('drag-handle')).toHaveLength(3);
  });
  
  it('should hide drag handle when enableReorder is false', () => {
    const steps = createMockSteps(3);
    
    render(<StepList steps={steps} enableReorder={false} />);
    
    expect(screen.queryByTestId('drag-handle')).not.toBeInTheDocument();
  });
  
  it('should hide drag handle in read-only mode', () => {
    const steps = createMockSteps(3);
    
    render(<StepList steps={steps} enableReorder readOnly />);
    
    expect(screen.queryByTestId('drag-handle')).not.toBeInTheDocument();
  });
  
  it('should call onReorder on drop', () => {
    const steps = createMockSteps(3);
    const onReorder = vi.fn();
    
    render(<StepList steps={steps} enableReorder onReorder={onReorder} />);
    
    const item0 = screen.getByTestId('step-item-0');
    const item2 = screen.getByTestId('step-item-2');
    
    fireEvent.dragStart(item0, {
      dataTransfer: { setData: vi.fn(), effectAllowed: 'move' },
    });
    
    fireEvent.dragOver(item2, { preventDefault: vi.fn() });
    fireEvent.drop(item2, { preventDefault: vi.fn() });
    
    expect(onReorder).toHaveBeenCalledWith(0, 2);
  });
});

// ============================================================================
// SIZE VARIANT TESTS
// ============================================================================

describe('StepList sizes', () => {
  afterEach(() => {
    cleanup();
  });
  
  it('should render small size', () => {
    const steps = createMockSteps(3);
    const { getByTestId } = render(<StepList steps={steps} size="small" />);
    
    expect(getByTestId('step-list')).toBeInTheDocument();
  });
  
  it('should render medium size', () => {
    const steps = createMockSteps(3);
    const { getByTestId } = render(<StepList steps={steps} size="medium" />);
    
    expect(getByTestId('step-list')).toBeInTheDocument();
  });
  
  it('should render large size', () => {
    const steps = createMockSteps(3);
    const { getByTestId } = render(<StepList steps={steps} size="large" />);
    
    expect(getByTestId('step-list')).toBeInTheDocument();
  });
});

// ============================================================================
// ACCESSIBILITY TESTS
// ============================================================================

describe('StepList accessibility', () => {
  afterEach(() => {
    cleanup();
  });
  
  it('should have role="list"', () => {
    const steps = createMockSteps(3);
    const { getByRole } = render(<StepList steps={steps} />);
    
    expect(getByRole('list')).toBeInTheDocument();
  });
  
  it('should have aria-label', () => {
    const steps = createMockSteps(3);
    const { getByLabelText } = render(<StepList steps={steps} />);
    
    expect(getByLabelText('Recorded steps')).toBeInTheDocument();
  });
  
  it('should have listitem roles', () => {
    const steps = createMockSteps(3);
    const { getAllByRole } = render(<StepList steps={steps} />);
    
    expect(getAllByRole('listitem')).toHaveLength(3);
  });
});

// ============================================================================
// KEYBOARD NAVIGATION TESTS
// ============================================================================

describe('StepList keyboard navigation', () => {
  afterEach(() => {
    cleanup();
  });
  
  it('should navigate down with arrow key', () => {
    const steps = createMockSteps(3);
    const onSelectionChange = vi.fn();
    
    render(
      <StepList
        steps={steps}
        selectedIds={[steps[0].id]}
        onSelectionChange={onSelectionChange}
      />
    );
    
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    
    expect(onSelectionChange).toHaveBeenCalledWith([steps[1].id]);
  });
  
  it('should navigate up with arrow key', () => {
    const steps = createMockSteps(3);
    const onSelectionChange = vi.fn();
    
    render(
      <StepList
        steps={steps}
        selectedIds={[steps[1].id]}
        onSelectionChange={onSelectionChange}
      />
    );
    
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    
    expect(onSelectionChange).toHaveBeenCalledWith([steps[0].id]);
  });
  
  it('should delete with Delete key', () => {
    const steps = createMockSteps(3);
    const onDelete = vi.fn();
    
    render(
      <StepList
        steps={steps}
        selectedIds={[steps[1].id]}
        onDelete={onDelete}
        onSelectionChange={vi.fn()}
      />
    );
    
    fireEvent.keyDown(window, { key: 'Delete' });
    
    expect(onDelete).toHaveBeenCalledWith(steps[1], 1);
  });
});

// ============================================================================
// STEP DESCRIPTION TESTS
// ============================================================================

describe('StepList step descriptions', () => {
  afterEach(() => {
    cleanup();
  });
  
  it('should show custom description', () => {
    const steps = [createMockStep({ description: 'Custom description' })];
    render(<StepList steps={steps} />);
    
    expect(screen.getByText('Custom description')).toBeInTheDocument();
  });
  
  it('should generate description for input step', () => {
    const steps = [createMockStep({ type: 'input', value: 'test@example.com' })];
    render(<StepList steps={steps} />);
    
    expect(screen.getByText(/Type "test@example.com"/)).toBeInTheDocument();
  });
  
  it('should generate description for navigate step', () => {
    const steps = [createMockStep({ type: 'navigate', url: 'https://example.com' })];
    render(<StepList steps={steps} />);
    
    expect(screen.getByText(/Navigate to/)).toBeInTheDocument();
  });
});
