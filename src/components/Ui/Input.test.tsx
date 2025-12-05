/**
 * Input Component Tests
 * @module components/Ui/Input.test
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  Input,
  Textarea,
  PasswordInput,
  SearchInput,
  UrlInput,
  NumberInput,
  FormField,
} from './Input';

// Mock scrollIntoView
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

// ============================================================================
// INPUT TESTS
// ============================================================================

describe('Input', () => {
  describe('Rendering', () => {
    it('should render input element', () => {
      render(<Input testId="my-input" />);
      expect(screen.getByTestId('my-input')).toBeInTheDocument();
    });

    it('should render with label', () => {
      render(<Input label="Email" testId="my-input" />);
      expect(screen.getByTestId('my-input-label')).toHaveTextContent('Email');
    });

    it('should render required indicator', () => {
      render(<Input label="Email" required testId="my-input" />);
      expect(screen.getByText('*')).toBeInTheDocument();
    });

    it('should render with placeholder', () => {
      render(<Input placeholder="Enter email" testId="my-input" />);
      expect(screen.getByPlaceholderText('Enter email')).toBeInTheDocument();
    });

    it('should render helper text', () => {
      render(<Input helperText="Enter your email address" testId="my-input" />);
      expect(screen.getByTestId('my-input-message')).toHaveTextContent('Enter your email address');
    });
  });

  describe('Types', () => {
    const types = ['text', 'email', 'password', 'number', 'url', 'search', 'tel'] as const;

    types.forEach((type) => {
      it(`should render ${type} input`, () => {
        render(<Input type={type} testId={`input-${type}`} />);
        expect(screen.getByTestId(`input-${type}`)).toHaveAttribute('type', type);
      });
    });
  });

  describe('Sizes', () => {
    const sizes = ['sm', 'md', 'lg'] as const;

    sizes.forEach((size) => {
      it(`should render ${size} size`, () => {
        render(<Input size={size} testId={`input-${size}`} />);
        expect(screen.getByTestId(`input-${size}`)).toBeInTheDocument();
      });
    });
  });

  describe('Variants', () => {
    const variants = ['default', 'outline', 'filled', 'ghost'] as const;

    variants.forEach((variant) => {
      it(`should render ${variant} variant`, () => {
        render(<Input variant={variant} testId={`input-${variant}`} />);
        expect(screen.getByTestId(`input-${variant}`)).toBeInTheDocument();
      });
    });
  });

  describe('Validation States', () => {
    it('should render error state', () => {
      render(<Input error="Invalid email" testId="my-input" />);
      
      const input = screen.getByTestId('my-input');
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByTestId('my-input-message')).toHaveTextContent('Invalid email');
    });

    it('should render success state', () => {
      render(<Input success="Email is valid" testId="my-input" />);
      expect(screen.getByTestId('my-input-message')).toHaveTextContent('Email is valid');
    });

    it('should render warning state', () => {
      render(<Input warning="Weak password" testId="my-input" />);
      expect(screen.getByTestId('my-input-message')).toHaveTextContent('Weak password');
    });

    it('should handle boolean error', () => {
      render(<Input error={true} testId="my-input" />);
      expect(screen.getByTestId('my-input')).toHaveAttribute('aria-invalid', 'true');
    });
  });

  describe('Addons', () => {
    it('should render left icon', () => {
      render(<Input leftIcon={<span data-testid="icon">@</span>} testId="my-input" />);
      expect(screen.getByTestId('icon')).toBeInTheDocument();
    });

    it('should render right icon', () => {
      render(<Input rightIcon={<span data-testid="icon">✓</span>} testId="my-input" />);
      expect(screen.getByTestId('icon')).toBeInTheDocument();
    });

    it('should render prefix', () => {
      render(<Input prefix="https://" testId="my-input" />);
      expect(screen.getByTestId('my-input-prefix')).toHaveTextContent('https://');
    });

    it('should render suffix', () => {
      render(<Input suffix=".com" testId="my-input" />);
      expect(screen.getByTestId('my-input-suffix')).toHaveTextContent('.com');
    });
  });

  describe('Clear Button', () => {
    it('should show clear button when clearable and has value', async () => {
      render(<Input clearable defaultValue="test" testId="my-input" />);
      expect(screen.getByTestId('my-input-clear')).toBeInTheDocument();
    });

    it('should hide clear button when empty', () => {
      render(<Input clearable testId="my-input" />);
      expect(screen.queryByTestId('my-input-clear')).not.toBeInTheDocument();
    });

    it('should clear value on click', async () => {
      const onChange = vi.fn();
      render(<Input clearable defaultValue="test" onChange={onChange} testId="my-input" />);
      
      await userEvent.click(screen.getByTestId('my-input-clear'));
      
      expect(screen.getByTestId('my-input')).toHaveValue('');
    });

    it('should call onClear callback', async () => {
      const onClear = vi.fn();
      render(<Input clearable defaultValue="test" onClear={onClear} testId="my-input" />);
      
      await userEvent.click(screen.getByTestId('my-input-clear'));
      
      expect(onClear).toHaveBeenCalled();
    });
  });

  describe('Character Count', () => {
    it('should show character count', () => {
      render(<Input showCount maxLength={100} defaultValue="Hello" testId="my-input" />);
      expect(screen.getByTestId('my-input-count')).toHaveTextContent('5/100');
    });

    it('should update count on input', async () => {
      render(<Input showCount maxLength={100} testId="my-input" />);
      
      await userEvent.type(screen.getByTestId('my-input'), 'Hello World');
      
      expect(screen.getByTestId('my-input-count')).toHaveTextContent('11/100');
    });
  });

  describe('States', () => {
    it('should render disabled state', () => {
      render(<Input disabled testId="my-input" />);
      expect(screen.getByTestId('my-input')).toBeDisabled();
    });

    it('should render readonly state', () => {
      render(<Input readOnly testId="my-input" />);
      expect(screen.getByTestId('my-input')).toHaveAttribute('readonly');
    });

    it('should render loading state', () => {
      render(<Input loading testId="my-input" />);
      expect(screen.getByTestId('my-input-loading')).toBeInTheDocument();
    });
  });

  describe('Controlled/Uncontrolled', () => {
    it('should work as controlled input', async () => {
      const onChange = vi.fn();
      const { rerender } = render(
        <Input value="initial" onChange={onChange} testId="my-input" />
      );
      
      expect(screen.getByTestId('my-input')).toHaveValue('initial');
      
      await userEvent.type(screen.getByTestId('my-input'), 'x');
      expect(onChange).toHaveBeenCalled();
      
      rerender(<Input value="updated" onChange={onChange} testId="my-input" />);
      expect(screen.getByTestId('my-input')).toHaveValue('updated');
    });

    it('should work as uncontrolled input', async () => {
      render(<Input defaultValue="initial" testId="my-input" />);
      
      expect(screen.getByTestId('my-input')).toHaveValue('initial');
      
      await userEvent.clear(screen.getByTestId('my-input'));
      await userEvent.type(screen.getByTestId('my-input'), 'changed');
      
      expect(screen.getByTestId('my-input')).toHaveValue('changed');
    });
  });

  describe('Accessibility', () => {
    it('should associate label with input', () => {
      render(<Input label="Email" testId="my-input" />);
      
      const input = screen.getByTestId('my-input');
      const label = screen.getByTestId('my-input-label');
      
      expect(label).toHaveAttribute('for', input.id);
    });

    it('should have aria-invalid when error', () => {
      render(<Input error="Invalid" testId="my-input" />);
      expect(screen.getByTestId('my-input')).toHaveAttribute('aria-invalid', 'true');
    });

    it('should have aria-describedby for error message', () => {
      render(<Input error="Invalid email" testId="my-input" id="email-input" />);
      
      const input = screen.getByTestId('my-input');
      expect(input).toHaveAttribute('aria-describedby', 'email-input-message');
    });
  });
});

// ============================================================================
// TEXTAREA TESTS
// ============================================================================

describe('Textarea', () => {
  it('should render textarea', () => {
    render(<Textarea testId="my-textarea" />);
    expect(screen.getByTestId('my-textarea').tagName).toBe('TEXTAREA');
  });

  it('should render with label', () => {
    render(<Textarea label="Description" testId="my-textarea" />);
    expect(screen.getByTestId('my-textarea-label')).toHaveTextContent('Description');
  });

  it('should render error state', () => {
    render(<Textarea error="Required field" testId="my-textarea" />);
    expect(screen.getByTestId('my-textarea-message')).toHaveTextContent('Required field');
  });

  it('should show character count', () => {
    render(<Textarea showCount maxLength={500} defaultValue="Hello" testId="my-textarea" />);
    expect(screen.getByTestId('my-textarea-count')).toHaveTextContent('5/500');
  });

  it('should handle controlled value', async () => {
    const onChange = vi.fn();
    render(<Textarea value="test" onChange={onChange} testId="my-textarea" />);
    
    await userEvent.type(screen.getByTestId('my-textarea'), 'x');
    expect(onChange).toHaveBeenCalled();
  });
});

// ============================================================================
// PASSWORD INPUT TESTS
// ============================================================================

describe('PasswordInput', () => {
  it('should render password input', () => {
    render(<PasswordInput testId="password" />);
    expect(screen.getByTestId('password')).toHaveAttribute('type', 'password');
  });

  it('should toggle password visibility', async () => {
    render(<PasswordInput testId="password" />);
    
    expect(screen.getByTestId('password')).toHaveAttribute('type', 'password');
    
    await userEvent.click(screen.getByTestId('password-toggle'));
    expect(screen.getByTestId('password')).toHaveAttribute('type', 'text');
    
    await userEvent.click(screen.getByTestId('password-toggle'));
    expect(screen.getByTestId('password')).toHaveAttribute('type', 'password');
  });

  it('should show strength indicator', async () => {
    render(<PasswordInput showStrength testId="password" />);
    
    await userEvent.type(screen.getByTestId('password'), 'Test123!');
    
    expect(screen.getByTestId('password-strength')).toBeInTheDocument();
    expect(screen.getByTestId('password-strength-label')).toBeInTheDocument();
  });

  it('should show strength feedback', async () => {
    render(<PasswordInput showStrength testId="password" />);
    
    await userEvent.type(screen.getByTestId('password'), 'weak');
    
    expect(screen.getByTestId('password-strength')).toBeInTheDocument();
  });

  it('should use custom strength calculator', async () => {
    const customCalculator = vi.fn().mockReturnValue({
      score: 4,
      label: 'Perfect',
      feedback: [],
    });
    
    render(
      <PasswordInput
        showStrength
        strengthCalculator={customCalculator}
        testId="password"
      />
    );
    
    await userEvent.type(screen.getByTestId('password'), 'test');
    
    expect(customCalculator).toHaveBeenCalledWith('test');
    expect(screen.getByTestId('password-strength-label')).toHaveTextContent('Perfect');
  });
});

// ============================================================================
// SEARCH INPUT TESTS
// ============================================================================

describe('SearchInput', () => {
  it('should render search input', () => {
    render(<SearchInput testId="search" />);
    expect(screen.getByTestId('search')).toHaveAttribute('type', 'search');
  });

  it('should have search icon', () => {
    render(<SearchInput testId="search" />);
    expect(screen.getByTestId('search-left-icon')).toBeInTheDocument();
  });

  it('should debounce onSearch callback', async () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    
    render(<SearchInput onSearch={onSearch} debounceMs={300} testId="search" />);
    
    const input = screen.getByTestId('search');
    fireEvent.change(input, { target: { value: 'test' } });
    
    expect(onSearch).not.toHaveBeenCalled();
    
    vi.advanceTimersByTime(350);
    
    expect(onSearch).toHaveBeenCalledWith('test');
    
    vi.useRealTimers();
  });

  it('should clear search', async () => {
    const onSearch = vi.fn();
    
    render(<SearchInput onSearch={onSearch} testId="search" defaultValue="test" />);
    
    fireEvent.click(screen.getByTestId('search-clear'));
    
    expect(screen.getByTestId('search')).toHaveValue('');
    expect(onSearch).toHaveBeenCalledWith('');
  });
});

// ============================================================================
// URL INPUT TESTS
// ============================================================================

describe('UrlInput', () => {
  it('should render url input', () => {
    render(<UrlInput testId="url" />);
    expect(screen.getByTestId('url')).toHaveAttribute('type', 'url');
  });

  it('should show protocol prefix', () => {
    render(<UrlInput showProtocol testId="url" />);
    expect(screen.getByTestId('url-prefix')).toHaveTextContent('https://');
  });

  it('should hide protocol prefix', () => {
    render(<UrlInput showProtocol={false} testId="url" />);
    expect(screen.queryByTestId('url-prefix')).not.toBeInTheDocument();
  });
});

// ============================================================================
// NUMBER INPUT TESTS
// ============================================================================

describe('NumberInput', () => {
  it('should render number input', () => {
    render(<NumberInput testId="number" />);
    expect(screen.getByTestId('number')).toHaveAttribute('type', 'number');
  });

  it('should show increment/decrement buttons', () => {
    render(<NumberInput showButtons testId="number" />);
    expect(screen.getByTestId('number-increment')).toBeInTheDocument();
    expect(screen.getByTestId('number-decrement')).toBeInTheDocument();
  });

  it('should increment value', async () => {
    const onChange = vi.fn();
    render(<NumberInput showButtons defaultValue="5" onChange={onChange} testId="number" />);
    
    fireEvent.click(screen.getByTestId('number-increment'));
    
    expect(onChange).toHaveBeenCalled();
  });

  it('should decrement value', async () => {
    const onChange = vi.fn();
    render(<NumberInput showButtons defaultValue="5" onChange={onChange} testId="number" />);
    
    fireEvent.click(screen.getByTestId('number-decrement'));
    
    expect(onChange).toHaveBeenCalled();
  });

  it('should respect min value', async () => {
    render(<NumberInput showButtons min={0} defaultValue="0" testId="number" />);
    
    const decrementBtn = screen.getByTestId('number-decrement');
    expect(decrementBtn).toBeDisabled();
  });

  it('should respect max value', async () => {
    render(<NumberInput showButtons max={10} defaultValue="10" testId="number" />);
    
    const incrementBtn = screen.getByTestId('number-increment');
    expect(incrementBtn).toBeDisabled();
  });

  it('should use step value', async () => {
    const onChange = vi.fn();
    render(<NumberInput showButtons step={5} defaultValue="0" onChange={onChange} testId="number" />);
    
    fireEvent.click(screen.getByTestId('number-increment'));
    
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.objectContaining({ value: '5' }),
      })
    );
  });
});

// ============================================================================
// FORM FIELD TESTS
// ============================================================================

describe('FormField', () => {
  it('should render form field', () => {
    render(
      <FormField label="Email" testId="form-field">
        <input />
      </FormField>
    );
    
    expect(screen.getByTestId('form-field')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('should show required indicator', () => {
    render(
      <FormField label="Email" required testId="form-field">
        <input />
      </FormField>
    );
    
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('should show error message', () => {
    render(
      <FormField label="Email" error="Invalid email" testId="form-field">
        <input />
      </FormField>
    );
    
    expect(screen.getByText('Invalid email')).toBeInTheDocument();
  });

  it('should show helper text', () => {
    render(
      <FormField label="Email" helperText="We'll never share" testId="form-field">
        <input />
      </FormField>
    );
    
    expect(screen.getByText("We'll never share")).toBeInTheDocument();
  });

  it('should prefer error over helper text', () => {
    render(
      <FormField label="Email" error="Invalid" helperText="Helper" testId="form-field">
        <input />
      </FormField>
    );
    
    expect(screen.getByText('Invalid')).toBeInTheDocument();
    expect(screen.queryByText('Helper')).not.toBeInTheDocument();
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('Edge Cases', () => {
  it('should forward ref', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<Input ref={ref} testId="my-input" />);
    
    expect(ref.current).toBe(screen.getByTestId('my-input'));
  });

  it('should handle rapid value changes', async () => {
    const onChange = vi.fn();
    render(<Input onChange={onChange} testId="my-input" />);
    
    const input = screen.getByTestId('my-input');
    
    for (let i = 0; i < 10; i++) {
      fireEvent.change(input, { target: { value: 'abcdefghij'.slice(0, i + 1) } });
    }
    
    expect(onChange).toHaveBeenCalledTimes(10);
  });

  it('should handle empty maxLength', () => {
    render(<Input showCount testId="my-input" />);
    // Should not show count without maxLength
    expect(screen.queryByTestId('my-input-count')).not.toBeInTheDocument();
  });

  it('should handle special characters in value', async () => {
    render(<Input testId="my-input" />);
    
    const input = screen.getByTestId('my-input');
    const specialChars = '<script>alert("xss")</script>';
    fireEvent.change(input, { target: { value: specialChars } });
    
    expect(input).toHaveValue(specialChars);
  });

  it('should handle very long values', async () => {
    const longValue = 'a'.repeat(10000);
    render(<Input defaultValue={longValue} testId="my-input" />);
    
    expect(screen.getByTestId('my-input')).toHaveValue(longValue);
  });
});
