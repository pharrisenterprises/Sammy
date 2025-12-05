/**
 * Tests for SearchBar component
 * @module components/Dashboard/SearchBar.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderHook } from '@testing-library/react';
import {
  SearchBar,
  SearchBarWithResults,
  useDebounce,
} from './SearchBar';

// ============================================================================
// TESTS
// ============================================================================

describe('SearchBar', () => {
  const defaultProps = {
    value: '',
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render search input', () => {
      render(<SearchBar {...defaultProps} />);
      expect(screen.getByTestId('search-bar-input')).toBeInTheDocument();
    });

    it('should render with placeholder', () => {
      render(<SearchBar {...defaultProps} placeholder="Search projects..." />);
      expect(screen.getByPlaceholderText('Search projects...')).toBeInTheDocument();
    });

    it('should render search icon', () => {
      render(<SearchBar {...defaultProps} />);
      const container = screen.getByTestId('search-bar');
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should show clear button when value present', () => {
      render(<SearchBar {...defaultProps} value="test" />);
      expect(screen.getByTestId('search-bar-clear')).toBeInTheDocument();
    });

    it('should not show clear button when empty', () => {
      render(<SearchBar {...defaultProps} value="" />);
      expect(screen.queryByTestId('search-bar-clear')).not.toBeInTheDocument();
    });

    it('should show loading spinner when isLoading', () => {
      render(<SearchBar {...defaultProps} isLoading={true} />);
      const container = screen.getByTestId('search-bar');
      expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('should be disabled when disabled prop is true', () => {
      render(<SearchBar {...defaultProps} disabled={true} />);
      expect(screen.getByTestId('search-bar-input')).toBeDisabled();
    });
  });

  describe('sizes', () => {
    it.each(['sm', 'md', 'lg'] as const)('should render %s size', (size) => {
      render(<SearchBar {...defaultProps} size={size} />);
      const input = screen.getByTestId('search-bar-input');
      expect(input).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('should call onChange when typing', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<SearchBar {...defaultProps} onChange={onChange} />);

      const input = screen.getByTestId('search-bar-input');
      await user.type(input, 'test');

      expect(onChange).toHaveBeenCalledWith('test');
    });

    it('should clear value when clear button clicked', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<SearchBar {...defaultProps} value="test" onChange={onChange} />);

      await user.click(screen.getByTestId('search-bar-clear'));

      expect(onChange).toHaveBeenCalledWith('');
    });

    it('should clear value on Escape key', async () => {
      const onChange = vi.fn();
      render(<SearchBar {...defaultProps} value="test" onChange={onChange} />);

      const input = screen.getByTestId('search-bar-input');
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(onChange).toHaveBeenCalledWith('');
    });

    it('should call onSubmit on Enter key', async () => {
      const onSubmit = vi.fn();
      render(<SearchBar {...defaultProps} value="test" onSubmit={onSubmit} />);

      const input = screen.getByTestId('search-bar-input');
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onSubmit).toHaveBeenCalledWith('test');
    });

    it('should call onFocus when focused', async () => {
      const user = userEvent.setup();
      const onFocus = vi.fn();
      render(<SearchBar {...defaultProps} onFocus={onFocus} />);

      const input = screen.getByTestId('search-bar-input');
      await user.click(input);

      expect(onFocus).toHaveBeenCalled();
    });

    it('should call onBlur when blurred', async () => {
      const user = userEvent.setup();
      const onBlur = vi.fn();
      render(<SearchBar {...defaultProps} onBlur={onBlur} />);

      const input = screen.getByTestId('search-bar-input');
      await user.click(input);
      await user.tab();

      expect(onBlur).toHaveBeenCalled();
    });
  });

  describe('debounce', () => {
    it('should debounce onChange calls', () => {
      vi.useFakeTimers();
      const onChange = vi.fn();
      
      render(<SearchBar {...defaultProps} onChange={onChange} debounceMs={300} />);

      const input = screen.getByTestId('search-bar-input');
      fireEvent.change(input, { target: { value: 'test' } });

      // onChange should not be called immediately
      expect(onChange).not.toHaveBeenCalled();

      // Fast-forward time
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(onChange).toHaveBeenCalledWith('test');

      vi.useRealTimers();
    });
  });

  describe('keyboard shortcuts', () => {
    it('should focus on Cmd+K (Mac)', async () => {
      render(<SearchBar {...defaultProps} />);

      const input = screen.getByTestId('search-bar-input');
      fireEvent.keyDown(document, { key: 'k', metaKey: true });

      expect(document.activeElement).toBe(input);
    });

    it('should focus on Ctrl+K (Windows)', async () => {
      render(<SearchBar {...defaultProps} />);

      const input = screen.getByTestId('search-bar-input');
      fireEvent.keyDown(document, { key: 'k', ctrlKey: true });

      expect(document.activeElement).toBe(input);
    });
  });

  describe('shortcut badge', () => {
    it('should show shortcut badge when showShortcut is true', () => {
      const { container } = render(<SearchBar {...defaultProps} showShortcut={true} />);
      const badge = container.querySelector('.inline-flex.items-center');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('K');
    });

    it('should hide shortcut badge when focused', () => {
      const { container } = render(<SearchBar {...defaultProps} showShortcut={true} />);

      const input = screen.getByTestId('search-bar-input');
      fireEvent.focus(input);

      const badge = container.querySelector('.inline-flex.items-center');
      expect(badge).not.toBeInTheDocument();
    });

    it('should hide shortcut badge when value present', () => {
      render(<SearchBar {...defaultProps} value="test" showShortcut={true} />);
      expect(screen.queryByText('K')).not.toBeInTheDocument();
    });
  });

  describe('autoFocus', () => {
    it('should focus input when autoFocus is true', () => {
      render(<SearchBar {...defaultProps} autoFocus={true} />);
      expect(document.activeElement).toBe(screen.getByTestId('search-bar-input'));
    });
  });

  describe('className', () => {
    it('should apply custom className', () => {
      render(<SearchBar {...defaultProps} className="custom-class" />);
      expect(screen.getByTestId('search-bar')).toHaveClass('custom-class');
    });
  });

  describe('disabled state', () => {
    it('should not show clear button when disabled', () => {
      render(<SearchBar {...defaultProps} value="test" disabled={true} />);
      expect(screen.queryByTestId('search-bar-clear')).not.toBeInTheDocument();
    });
  });

  describe('Escape key behavior', () => {
    it('should blur input on Escape when value is empty', () => {
      render(<SearchBar {...defaultProps} value="" />);
      const input = screen.getByTestId('search-bar-input');
      
      input.focus();
      expect(document.activeElement).toBe(input);
      
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(document.activeElement).not.toBe(input);
    });
  });

  describe('focus after clear', () => {
    it('should focus input after clearing', () => {
      render(<SearchBar {...defaultProps} value="test" />);

      fireEvent.click(screen.getByTestId('search-bar-clear'));
      expect(document.activeElement).toBe(screen.getByTestId('search-bar-input'));
    });
  });
});

describe('SearchBarWithResults', () => {
  const mockResults = [
    { id: '1', label: 'Project Alpha', description: 'First project' },
    { id: '2', label: 'Project Beta', description: 'Second project' },
    { id: '3', label: 'Project Gamma', description: 'Third project' },
  ];

  const defaultProps = {
    value: 'project',
    onChange: vi.fn(),
    results: mockResults,
    onSelect: vi.fn(),
    testId: 'search-bar',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show results when focused with value', () => {
    render(<SearchBarWithResults {...defaultProps} />);

    fireEvent.focus(screen.getByTestId('search-bar-input'));

    expect(screen.getByTestId('search-bar-results')).toBeInTheDocument();
  });

  it('should display result items', () => {
    render(<SearchBarWithResults {...defaultProps} />);

    fireEvent.focus(screen.getByTestId('search-bar-input'));

    expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    expect(screen.getByText('Project Beta')).toBeInTheDocument();
  });

  it('should limit results to maxResults', () => {
    render(<SearchBarWithResults {...defaultProps} maxResults={2} />);

    fireEvent.focus(screen.getByTestId('search-bar-input'));

    expect(screen.getByTestId('search-bar-result-0')).toBeInTheDocument();
    expect(screen.getByTestId('search-bar-result-1')).toBeInTheDocument();
    expect(screen.queryByTestId('search-bar-result-2')).not.toBeInTheDocument();
  });

  it('should call onSelect when result clicked', () => {
    const onSelect = vi.fn();
    render(<SearchBarWithResults {...defaultProps} onSelect={onSelect} />);

    fireEvent.focus(screen.getByTestId('search-bar-input'));
    fireEvent.click(screen.getByTestId('search-bar-result-0'));

    expect(onSelect).toHaveBeenCalledWith(mockResults[0]);
  });

  it('should show no results text when empty', () => {
    render(
      <SearchBarWithResults
        {...defaultProps}
        results={[]}
        noResultsText="No projects found"
      />
    );

    fireEvent.focus(screen.getByTestId('search-bar-input'));

    expect(screen.getByText('No projects found')).toBeInTheDocument();
  });

  it('should navigate results with arrow keys', () => {
    render(<SearchBarWithResults {...defaultProps} />);

    const input = screen.getByTestId('search-bar-input');
    fireEvent.focus(input);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const firstResult = screen.getByTestId('search-bar-result-0');
    expect(firstResult).toHaveClass('bg-blue-50');
  });

  it('should wrap to first result when pressing ArrowDown on last result', () => {
    render(<SearchBarWithResults {...defaultProps} />);

    const input = screen.getByTestId('search-bar-input');
    fireEvent.focus(input);

    // Navigate to last result
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    
    // Press down again, should wrap to first
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    
    const firstResult = screen.getByTestId('search-bar-result-0');
    expect(firstResult).toHaveClass('bg-blue-50');
  });

  it('should wrap to last result when pressing ArrowUp on first result', () => {
    render(<SearchBarWithResults {...defaultProps} />);

    const input = screen.getByTestId('search-bar-input');
    fireEvent.focus(input);

    // Press up from no selection, should go to last
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    
    const lastResult = screen.getByTestId('search-bar-result-2');
    expect(lastResult).toHaveClass('bg-blue-50');
  });

  it('should select result on Enter key', () => {
    const onSelect = vi.fn();
    render(<SearchBarWithResults {...defaultProps} onSelect={onSelect} />);

    const input = screen.getByTestId('search-bar-input');
    fireEvent.focus(input);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSelect).toHaveBeenCalledWith(mockResults[0]);
  });

  it('should hide results when clicking outside', () => {
    render(
      <div>
        <SearchBarWithResults {...defaultProps} />
        <button data-testid="outside">Outside</button>
      </div>
    );

    fireEvent.focus(screen.getByTestId('search-bar-input'));
    expect(screen.getByTestId('search-bar-results')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId('outside'));
    // Results should be hidden after mousedown outside
    expect(screen.queryByTestId('search-bar-results')).not.toBeInTheDocument();
  });

  it('should display result descriptions', () => {
    render(<SearchBarWithResults {...defaultProps} />);

    fireEvent.focus(screen.getByTestId('search-bar-input'));

    expect(screen.getByText('First project')).toBeInTheDocument();
  });

  it('should display result icons when provided', () => {
    const resultsWithIcons = [
      { ...mockResults[0], icon: <span data-testid="icon-1">Icon</span> },
    ];
    render(<SearchBarWithResults {...defaultProps} results={resultsWithIcons} />);

    fireEvent.focus(screen.getByTestId('search-bar-input'));

    expect(screen.getByTestId('icon-1')).toBeInTheDocument();
  });

  it('should not show results when value is empty', () => {
    render(<SearchBarWithResults {...defaultProps} value="" />);

    fireEvent.focus(screen.getByTestId('search-bar-input'));

    expect(screen.queryByTestId('search-bar-results')).not.toBeInTheDocument();
  });
});

describe('useDebounce', () => {
  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('test', 300));
    expect(result.current).toBe('test');
  });

  it('should debounce value changes', async () => {
    vi.useFakeTimers();

    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 300 } }
    );

    expect(result.current).toBe('initial');

    rerender({ value: 'changed', delay: 300 });
    expect(result.current).toBe('initial');

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe('changed');

    vi.useRealTimers();
  });

  it('should reset timer on rapid changes', async () => {
    vi.useFakeTimers();

    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 300 } }
    );

    rerender({ value: 'change1', delay: 300 });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    rerender({ value: 'change2', delay: 300 });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Should still be initial
    expect(result.current).toBe('initial');

    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Now should be latest value
    expect(result.current).toBe('change2');

    vi.useRealTimers();
  });
});
