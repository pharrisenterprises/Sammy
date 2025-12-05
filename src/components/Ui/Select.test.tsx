/**
 * Tests for Select component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock scrollIntoView
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
import {
  Select,
  MultiSelect,
  NativeSelect,
  StepSelector,
  SelectOption,
  SelectGroup,
} from './Select';

// ============================================================================
// TEST DATA
// ============================================================================

const basicOptions: SelectOption[] = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
  { value: 'date', label: 'Date' },
];

const optionsWithDisabled: SelectOption[] = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana', disabled: true },
  { value: 'cherry', label: 'Cherry' },
];

const optionsWithDescriptions: SelectOption[] = [
  { value: '1', label: 'Option 1', description: 'First option' },
  { value: '2', label: 'Option 2', description: 'Second option' },
  { value: '3', label: 'Option 3', description: 'Third option' },
];

const groupedOptions: SelectGroup[] = [
  {
    label: 'Fruits',
    options: [
      { value: 'apple', label: 'Apple' },
      { value: 'banana', label: 'Banana' },
    ],
  },
  {
    label: 'Vegetables',
    options: [
      { value: 'carrot', label: 'Carrot' },
      { value: 'potato', label: 'Potato' },
    ],
  },
];

// ============================================================================
// SELECT TESTS
// ============================================================================

describe('Select', () => {
  describe('Rendering', () => {
    it('renders with placeholder', () => {
      render(
        <Select
          options={basicOptions}
          placeholder="Choose fruit"
          testId="test-select"
        />
      );

      expect(screen.getByTestId('test-select-trigger')).toHaveTextContent('Choose fruit');
    });

    it('renders with selected value', () => {
      render(
        <Select
          value="apple"
          options={basicOptions}
          testId="test-select"
        />
      );

      expect(screen.getByTestId('test-select-trigger')).toHaveTextContent('Apple');
    });

    it('renders loading state', () => {
      render(
        <Select
          loading
          options={basicOptions}
          testId="test-select"
        />
      );

      expect(screen.getByTestId('test-select-trigger')).toHaveTextContent('Loading...');
    });
  });

  describe('Opening/Closing', () => {
    it('opens dropdown on click', async () => {
      const user = userEvent.setup();

      render(
        <Select
          options={basicOptions}
          testId="test-select"
        />
      );

      await user.click(screen.getByTestId('test-select-trigger'));

      expect(screen.getByTestId('test-select-dropdown')).toBeInTheDocument();
      expect(screen.getByText('Apple')).toBeInTheDocument();
    });

    it('closes dropdown on Escape key', async () => {
      const user = userEvent.setup();

      render(
        <Select
          options={basicOptions}
          testId="test-select"
        />
      );

      await user.click(screen.getByTestId('test-select-trigger'));
      expect(screen.getByTestId('test-select-dropdown')).toBeInTheDocument();

      fireEvent.keyDown(screen.getByTestId('test-select-trigger'), { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByTestId('test-select-dropdown')).not.toBeInTheDocument();
      });
    });

    it('closes dropdown on outside click', async () => {
      const user = userEvent.setup();

      render(
        <div>
          <Select
            options={basicOptions}
            testId="test-select"
          />
          <button>Outside</button>
        </div>
      );

      await user.click(screen.getByTestId('test-select-trigger'));
      expect(screen.getByTestId('test-select-dropdown')).toBeInTheDocument();

      await user.click(screen.getByText('Outside'));

      await waitFor(() => {
        expect(screen.queryByTestId('test-select-dropdown')).not.toBeInTheDocument();
      });
    });
  });

  describe('Selection', () => {
    it('selects option on click', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(
        <Select
          onChange={onChange}
          options={basicOptions}
          testId="test-select"
        />
      );

      await user.click(screen.getByTestId('test-select-trigger'));
      await user.click(screen.getByText('Banana'));

      expect(onChange).toHaveBeenCalledWith('banana');
    });

    it('clears selection with clear button', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(
        <Select
          value="apple"
          onChange={onChange}
          options={basicOptions}
          clearable
          testId="test-select"
        />
      );

      await user.click(screen.getByTestId('test-select-clear'));

      expect(onChange).toHaveBeenCalledWith(null);
    });

    it('does not select disabled option', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(
        <Select
          onChange={onChange}
          options={optionsWithDisabled}
          testId="test-select"
        />
      );

      await user.click(screen.getByTestId('test-select-trigger'));
      
      const bananaOption = screen.getByText('Banana').parentElement!;
      await user.click(bananaOption);

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard Navigation', () => {
    it('opens on ArrowDown', async () => {
      render(
        <Select
          options={basicOptions}
          testId="test-select"
        />
      );

      const trigger = screen.getByTestId('test-select-trigger');
      fireEvent.keyDown(trigger, { key: 'ArrowDown' });

      await waitFor(() => {
        expect(screen.getByTestId('test-select-dropdown')).toBeInTheDocument();
      });
    });

    it('navigates with arrow keys', async () => {
      render(
        <Select
          options={basicOptions}
          testId="test-select"
        />
      );

      const trigger = screen.getByTestId('test-select-trigger');
      fireEvent.keyDown(trigger, { key: 'ArrowDown' });

      await waitFor(() => {
        expect(screen.getByTestId('test-select-dropdown')).toBeInTheDocument();
      });

      // First arrow down highlights index 0
      await waitFor(() => {
        const option0 = screen.getByTestId('test-select-option-0');
        expect(option0).toHaveAttribute('data-highlighted', 'true');
      });

      fireEvent.keyDown(trigger, { key: 'ArrowDown' });

      // Second arrow down highlights index 1
      await waitFor(() => {
        const option1 = screen.getByTestId('test-select-option-1');
        expect(option1).toHaveAttribute('data-highlighted', 'true');
      });
    });

    it('selects with Enter key', async () => {
      const onChange = vi.fn();

      render(
        <Select
          onChange={onChange}
          options={basicOptions}
          testId="test-select"
        />
      );

      const trigger = screen.getByTestId('test-select-trigger');
      fireEvent.keyDown(trigger, { key: 'ArrowDown' });

      await waitFor(() => {
        expect(screen.getByTestId('test-select-dropdown')).toBeInTheDocument();
      });

      // Wait for highlight to be set
      await waitFor(() => {
        expect(screen.getByTestId('test-select-option-0')).toHaveAttribute('data-highlighted', 'true');
      });

      fireEvent.keyDown(trigger, { key: 'Enter' });

      expect(onChange).toHaveBeenCalledWith('apple');
    });

    it('jumps to first option with Home key', async () => {
      render(
        <Select
          options={basicOptions}
          testId="test-select"
        />
      );

      const trigger = screen.getByTestId('test-select-trigger');
      fireEvent.keyDown(trigger, { key: 'ArrowDown' });

      await waitFor(() => {
        expect(screen.getByTestId('test-select-dropdown')).toBeInTheDocument();
      });

      // Navigate down twice
      fireEvent.keyDown(trigger, { key: 'ArrowDown' });
      fireEvent.keyDown(trigger, { key: 'ArrowDown' });

      // Jump to first
      fireEvent.keyDown(trigger, { key: 'Home' });

      await waitFor(() => {
        expect(screen.getByTestId('test-select-option-0')).toHaveAttribute('data-highlighted', 'true');
      });
    });
  });

  describe('Search', () => {
    it('filters options by search query', async () => {
      const user = userEvent.setup();

      render(
        <Select
          options={basicOptions}
          searchable
          testId="test-select"
        />
      );

      await user.click(screen.getByTestId('test-select-trigger'));
      
      const searchInput = screen.getByTestId('test-select-search');
      await user.type(searchInput, 'ban');

      expect(screen.getByText('Banana')).toBeInTheDocument();
      expect(screen.queryByText('Apple')).not.toBeInTheDocument();
    });

    it('shows no results message', async () => {
      const user = userEvent.setup();

      render(
        <Select
          options={basicOptions}
          searchable
          noResultsMessage="Nothing found"
          testId="test-select"
        />
      );

      await user.click(screen.getByTestId('test-select-trigger'));
      
      const searchInput = screen.getByTestId('test-select-search');
      await user.type(searchInput, 'xyz');

      expect(screen.getByText('Nothing found')).toBeInTheDocument();
    });
  });

  describe('Grouped Options', () => {
    it('renders grouped options with labels', async () => {
      const user = userEvent.setup();

      render(
        <Select
          options={groupedOptions}
          testId="test-select"
        />
      );

      await user.click(screen.getByTestId('test-select-trigger'));

      expect(screen.getByText('Fruits')).toBeInTheDocument();
      expect(screen.getByText('Vegetables')).toBeInTheDocument();
      expect(screen.getByText('Apple')).toBeInTheDocument();
      expect(screen.getByText('Carrot')).toBeInTheDocument();
    });
  });

  describe('Sizes', () => {
    it('renders small size', () => {
      render(
        <Select
          options={basicOptions}
          size="sm"
          testId="test-select"
        />
      );

      expect(screen.getByTestId('test-select-trigger')).toHaveClass('h-8');
    });

    it('renders medium size', () => {
      render(
        <Select
          options={basicOptions}
          size="md"
          testId="test-select"
        />
      );

      expect(screen.getByTestId('test-select-trigger')).toHaveClass('h-10');
    });

    it('renders large size', () => {
      render(
        <Select
          options={basicOptions}
          size="lg"
          testId="test-select"
        />
      );

      expect(screen.getByTestId('test-select-trigger')).toHaveClass('h-12');
    });
  });

  describe('Variants', () => {
    it('renders default variant', () => {
      render(
        <Select
          options={basicOptions}
          variant="default"
          testId="test-select"
        />
      );

      expect(screen.getByTestId('test-select-trigger')).toHaveClass('bg-white');
    });

    it('renders outline variant', () => {
      render(
        <Select
          options={basicOptions}
          variant="outline"
          testId="test-select"
        />
      );

      expect(screen.getByTestId('test-select-trigger')).toHaveClass('border-2');
    });

    it('renders filled variant', () => {
      render(
        <Select
          options={basicOptions}
          variant="filled"
          testId="test-select"
        />
      );

      expect(screen.getByTestId('test-select-trigger')).toHaveClass('bg-gray-100');
    });

    it('renders ghost variant', () => {
      render(
        <Select
          options={basicOptions}
          variant="ghost"
          testId="test-select"
        />
      );

      expect(screen.getByTestId('test-select-trigger')).toHaveClass('bg-transparent');
    });
  });

  describe('States', () => {
    it('renders disabled state', () => {
      render(
        <Select
          options={basicOptions}
          disabled
          testId="test-select"
        />
      );

      expect(screen.getByTestId('test-select-trigger')).toBeDisabled();
    });

    it('renders error state', () => {
      render(
        <Select
          options={basicOptions}
          error
          errorMessage="This field is required"
          testId="test-select"
        />
      );

      expect(screen.getByTestId('test-select-error')).toHaveTextContent('This field is required');
      expect(screen.getByTestId('test-select-trigger')).toHaveClass('border-red-500');
    });

    it('shows empty message when no options', async () => {
      const user = userEvent.setup();

      render(
        <Select
          options={[]}
          emptyMessage="No items"
          testId="test-select"
        />
      );

      await user.click(screen.getByTestId('test-select-trigger'));

      expect(screen.getByText('No items')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has correct ARIA attributes', () => {
      render(
        <Select
          options={basicOptions}
          aria-label="Fruit selector"
          testId="test-select"
        />
      );

      const trigger = screen.getByTestId('test-select-trigger');
      expect(trigger).toHaveAttribute('role', 'combobox');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
      expect(trigger).toHaveAttribute('aria-label', 'Fruit selector');
    });
  });
});

// ============================================================================
// MULTI-SELECT TESTS
// ============================================================================

describe('MultiSelect', () => {
  describe('Rendering', () => {
    it('renders with placeholder when empty', () => {
      render(
        <MultiSelect
          value={[]}
          options={basicOptions}
          placeholder="Select fruits"
          testId="test-multi"
        />
      );

      expect(screen.getByTestId('test-multi-trigger')).toHaveTextContent('Select fruits');
    });

    it('renders selected values as tags', () => {
      render(
        <MultiSelect
          value={['apple', 'banana']}
          options={basicOptions}
          testId="test-multi"
        />
      );

      expect(screen.getByText('Apple')).toBeInTheDocument();
      expect(screen.getByText('Banana')).toBeInTheDocument();
    });

    it('shows overflow count when > 3 selected', () => {
      render(
        <MultiSelect
          value={['apple', 'banana', 'cherry', 'date']}
          options={basicOptions}
          showCount
          testId="test-multi"
        />
      );

      expect(screen.getByText('+1 more')).toBeInTheDocument();
    });
  });

  describe('Selection', () => {
    it('adds option on click', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(
        <MultiSelect
          value={[]}
          onChange={onChange}
          options={basicOptions}
          testId="test-multi"
        />
      );

      await user.click(screen.getByTestId('test-multi-trigger'));
      await user.click(screen.getByText('Apple'));

      expect(onChange).toHaveBeenCalledWith(['apple']);
    });

    it('removes option on second click', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(
        <MultiSelect
          value={['apple']}
          onChange={onChange}
          options={basicOptions}
          testId="test-multi"
        />
      );

      await user.click(screen.getByTestId('test-multi-trigger'));
      
      // Get the option in the dropdown (not the tag)
      const appleOptions = screen.getAllByText('Apple');
      const appleInDropdown = appleOptions.find(el => 
        el.closest('[role="option"]')
      )!;
      await user.click(appleInDropdown);

      expect(onChange).toHaveBeenCalledWith([]);
    });

    it('removes tag with close button', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(
        <MultiSelect
          value={['apple', 'banana']}
          onChange={onChange}
          options={basicOptions}
          testId="test-multi"
        />
      );

      const appleTag = screen.getByText('Apple').parentElement!;
      const closeButton = appleTag.querySelector('button')!;
      await user.click(closeButton);

      expect(onChange).toHaveBeenCalledWith(['banana']);
    });

    it('clears all with clear button', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(
        <MultiSelect
          value={['apple', 'banana']}
          onChange={onChange}
          options={basicOptions}
          clearable
          testId="test-multi"
        />
      );

      await user.click(screen.getByTestId('test-multi-clear'));

      expect(onChange).toHaveBeenCalledWith([]);
    });

    it('respects maxSelections limit', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(
        <MultiSelect
          value={['apple', 'banana']}
          onChange={onChange}
          options={basicOptions}
          maxSelections={2}
          testId="test-multi"
        />
      );

      await user.click(screen.getByTestId('test-multi-trigger'));
      await user.click(screen.getByText('Cherry'));

      expect(onChange).not.toHaveBeenCalled();
      expect(screen.getByText(/Maximum 2 selections reached/)).toBeInTheDocument();
    });

    it('removes last selection with Backspace', async () => {
      const onChange = vi.fn();

      render(
        <MultiSelect
          value={['apple', 'banana']}
          onChange={onChange}
          options={basicOptions}
          searchable
          testId="test-multi"
        />
      );

      const trigger = screen.getByTestId('test-multi-trigger');
      fireEvent.keyDown(trigger, { key: 'Backspace' });

      expect(onChange).toHaveBeenCalledWith(['apple']);
    });
  });

  describe('Checkboxes', () => {
    it('shows checkboxes for all options', async () => {
      const user = userEvent.setup();

      render(
        <MultiSelect
          value={['apple']}
          options={basicOptions}
          testId="test-multi"
        />
      );

      await user.click(screen.getByTestId('test-multi-trigger'));

      const options = screen.getAllByRole('option');
      expect(options.length).toBe(4);

      // Check for checkbox styling (border-blue-600 for selected)
      const appleOptions = screen.getAllByText('Apple');
      const appleOption = appleOptions.find(el => 
        el.closest('[role="option"]')
      )!.closest('[role="option"]')!;
      const checkbox = appleOption.querySelector('div');
      expect(checkbox).toHaveClass('border-blue-600');
    });
  });
});

// ============================================================================
// NATIVE SELECT TESTS
// ============================================================================

describe('NativeSelect', () => {
  it('renders native select element', () => {
    render(
      <NativeSelect
        options={basicOptions}
        testId="test-native"
      />
    );

    expect(screen.getByTestId('test-native')).toBeInTheDocument();
    expect(screen.getByTestId('test-native').tagName).toBe('SELECT');
  });

  it('renders placeholder as disabled option', () => {
    render(
      <NativeSelect
        options={basicOptions}
        placeholder="Choose one"
        testId="test-native"
      />
    );

    const placeholder = screen.getByText('Choose one');
    expect(placeholder).toBeInTheDocument();
    expect(placeholder).toHaveAttribute('disabled');
  });

  it('calls onChange with selected value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <NativeSelect
        onChange={onChange}
        options={basicOptions}
        testId="test-native"
      />
    );

    await user.selectOptions(screen.getByTestId('test-native'), 'banana');

    expect(onChange).toHaveBeenCalledWith('banana');
  });

  it('disables options correctly', () => {
    render(
      <NativeSelect
        options={optionsWithDisabled}
        testId="test-native"
      />
    );

    const banana = screen.getByText('Banana');
    expect(banana).toHaveAttribute('disabled');
  });
});

// ============================================================================
// STEP SELECTOR TESTS
// ============================================================================

describe('StepSelector', () => {
  const steps = [
    { label: 'Click Button', event: 'click' },
    { label: 'Fill Form', event: 'input' },
    { label: 'Submit', event: 'enter' },
  ];

  it('renders step options with event descriptions', async () => {
    const user = userEvent.setup();

    render(
      <StepSelector
        steps={steps}
        testId="test-steps"
      />
    );

    await user.click(screen.getByTestId('test-steps-trigger'));

    expect(screen.getByText('Click Button')).toBeInTheDocument();
    expect(screen.getByText('Event: click')).toBeInTheDocument();
  });

  it('calls onChange with step label', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <StepSelector
        onChange={onChange}
        steps={steps}
        testId="test-steps"
      />
    );

    await user.click(screen.getByTestId('test-steps-trigger'));
    await user.click(screen.getByText('Fill Form'));

    expect(onChange).toHaveBeenCalledWith('Fill Form');
  });

  it('enables search when > 5 steps', async () => {
    const user = userEvent.setup();
    const manySteps = Array.from({ length: 10 }, (_, i) => ({
      label: `Step ${i + 1}`,
      event: 'click',
    }));

    render(
      <StepSelector
        steps={manySteps}
        testId="test-steps"
      />
    );

    await user.click(screen.getByTestId('test-steps-trigger'));

    expect(screen.getByTestId('test-steps-search')).toBeInTheDocument();
  });

  it('is clearable', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <StepSelector
        value="Click Button"
        onChange={onChange}
        steps={steps}
        testId="test-steps"
      />
    );

    await user.click(screen.getByTestId('test-steps-clear'));

    expect(onChange).toHaveBeenCalledWith(null);
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('Edge Cases', () => {
  it('handles empty options array', async () => {
    const user = userEvent.setup();

    render(
      <Select
        options={[]}
        emptyMessage="No options"
        testId="test-select"
      />
    );

    await user.click(screen.getByTestId('test-select-trigger'));

    expect(screen.getByText('No options')).toBeInTheDocument();
  });

  it('handles options with duplicate labels', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    const options: SelectOption[] = [
      { value: '1', label: 'Same' },
      { value: '2', label: 'Same' },
    ];

    render(
      <Select
        onChange={onChange}
        options={options}
        testId="test-select"
      />
    );

    await user.click(screen.getByTestId('test-select-trigger'));
    
    const opts = screen.getAllByText('Same');
    await user.click(opts[1]);

    expect(onChange).toHaveBeenCalledWith('2');
  });

  it('handles rapid opening and closing', async () => {
    const user = userEvent.setup();

    render(
      <Select
        options={basicOptions}
        testId="test-select"
      />
    );

    const trigger = screen.getByTestId('test-select-trigger');

    await user.click(trigger);
    await user.click(trigger);
    await user.click(trigger);

    expect(screen.getByTestId('test-select-dropdown')).toBeInTheDocument();
  });

  it('handles very long option labels', () => {
    const longOptions: SelectOption[] = [
      { value: '1', label: 'A'.repeat(100) },
    ];

    render(
      <Select
        value="1"
        options={longOptions}
        testId="test-select"
      />
    );

    const trigger = screen.getByTestId('test-select-trigger');
    expect(trigger).toHaveTextContent('A'.repeat(100));
  });

  it('handles custom renderOption function', async () => {
    const user = userEvent.setup();

    render(
      <Select
        options={basicOptions}
        renderOption={(opt) => <div>Custom: {opt.label}</div>}
        testId="test-select"
      />
    );

    await user.click(screen.getByTestId('test-select-trigger'));

    expect(screen.getByText('Custom: Apple')).toBeInTheDocument();
  });
});
