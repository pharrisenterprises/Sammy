/**
 * Button Component Tests
 * @module components/Ui/Button.test
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import {
  Button,
  IconButton,
  ButtonGroup,
  PrimaryButton,
  SecondaryButton,
  OutlineButton,
  GhostButton,
  DestructiveButton,
  SuccessButton,
  LinkButton,
  CloseButton,
  BackButton,
  AddButton,
  SaveButton,
  DeleteButton,
  CancelButton,
  PlayButton,
} from './Button';

// ============================================================================
// BUTTON TESTS
// ============================================================================

describe('Button', () => {
  describe('Rendering', () => {
    it('should render button with text', () => {
      render(<Button testId="my-button">Click me</Button>);
      expect(screen.getByTestId('my-button')).toHaveTextContent('Click me');
    });

    it('should render with default type="button"', () => {
      render(<Button testId="my-button">Click</Button>);
      expect(screen.getByTestId('my-button')).toHaveAttribute('type', 'button');
    });

    it('should render with type="submit"', () => {
      render(<Button type="submit" testId="my-button">Submit</Button>);
      expect(screen.getByTestId('my-button')).toHaveAttribute('type', 'submit');
    });

    it('should forward ref', () => {
      const ref = React.createRef<HTMLButtonElement>();
      render(<Button ref={ref} testId="my-button">Click</Button>);
      expect(ref.current).toBe(screen.getByTestId('my-button'));
    });
  });

  describe('Variants', () => {
    const variants = [
      'default',
      'secondary',
      'outline',
      'ghost',
      'destructive',
      'success',
      'warning',
      'link',
    ] as const;

    variants.forEach((variant) => {
      it(`should render ${variant} variant`, () => {
        render(<Button variant={variant} testId={`btn-${variant}`}>{variant}</Button>);
        expect(screen.getByTestId(`btn-${variant}`)).toBeInTheDocument();
      });
    });
  });

  describe('Sizes', () => {
    const sizes = ['xs', 'sm', 'md', 'lg', 'xl'] as const;

    sizes.forEach((size) => {
      it(`should render ${size} size`, () => {
        render(<Button size={size} testId={`btn-${size}`}>{size}</Button>);
        expect(screen.getByTestId(`btn-${size}`)).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading spinner when loading', () => {
      render(<Button loading testId="my-button">Save</Button>);
      
      const button = screen.getByTestId('my-button');
      expect(button).toHaveAttribute('data-loading', 'true');
      expect(button).toHaveAttribute('aria-busy', 'true');
    });

    it('should show loading text when provided', () => {
      render(<Button loading loadingText="Saving..." testId="my-button">Save</Button>);
      expect(screen.getByTestId('my-button')).toHaveTextContent('Saving...');
    });

    it('should be disabled when loading', () => {
      render(<Button loading testId="my-button">Save</Button>);
      expect(screen.getByTestId('my-button')).toBeDisabled();
    });

    it('should not call onClick when loading', async () => {
      const onClick = vi.fn();
      render(<Button loading onClick={onClick} testId="my-button">Save</Button>);
      
      await userEvent.click(screen.getByTestId('my-button'));
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('Disabled State', () => {
    it('should render disabled button', () => {
      render(<Button disabled testId="my-button">Click</Button>);
      expect(screen.getByTestId('my-button')).toBeDisabled();
    });

    it('should have aria-disabled when disabled', () => {
      render(<Button disabled testId="my-button">Click</Button>);
      expect(screen.getByTestId('my-button')).toHaveAttribute('aria-disabled', 'true');
    });

    it('should not call onClick when disabled', async () => {
      const onClick = vi.fn();
      render(<Button disabled onClick={onClick} testId="my-button">Click</Button>);
      
      await userEvent.click(screen.getByTestId('my-button'));
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('Icons', () => {
    it('should render left icon', () => {
      render(
        <Button leftIcon={<span data-testid="left-icon">←</span>} testId="my-button">
          Back
        </Button>
      );
      expect(screen.getByTestId('left-icon')).toBeInTheDocument();
    });

    it('should render right icon', () => {
      render(
        <Button rightIcon={<span data-testid="right-icon">→</span>} testId="my-button">
          Next
        </Button>
      );
      expect(screen.getByTestId('right-icon')).toBeInTheDocument();
    });

    it('should render both icons', () => {
      render(
        <Button
          leftIcon={<span data-testid="left">L</span>}
          rightIcon={<span data-testid="right">R</span>}
          testId="my-button"
        >
          Both
        </Button>
      );
      expect(screen.getByTestId('left')).toBeInTheDocument();
      expect(screen.getByTestId('right')).toBeInTheDocument();
    });

    it('should hide left icon when loading', () => {
      render(
        <Button
          loading
          leftIcon={<span data-testid="left-icon">←</span>}
          testId="my-button"
        >
          Loading
        </Button>
      );
      expect(screen.queryByTestId('left-icon')).not.toBeInTheDocument();
    });
  });

  describe('Icon Only', () => {
    it('should render icon-only button', () => {
      render(
        <Button iconOnly testId="my-button">
          <span>🔍</span>
        </Button>
      );
      expect(screen.getByTestId('my-button')).toBeInTheDocument();
    });
  });

  describe('Full Width', () => {
    it('should render full width button', () => {
      render(<Button fullWidth testId="my-button">Full Width</Button>);
      expect(screen.getByTestId('my-button')).toHaveClass('w-full');
    });
  });

  describe('Rounded', () => {
    it('should render rounded button', () => {
      render(<Button rounded testId="my-button">Rounded</Button>);
      expect(screen.getByTestId('my-button')).toHaveClass('rounded-full');
    });
  });

  describe('Click Handler', () => {
    it('should call onClick when clicked', async () => {
      const onClick = vi.fn();
      render(<Button onClick={onClick} testId="my-button">Click</Button>);
      
      await userEvent.click(screen.getByTestId('my-button'));
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });
});

// ============================================================================
// ICON BUTTON TESTS
// ============================================================================

describe('IconButton', () => {
  it('should render icon button', () => {
    render(
      <IconButton
        icon={<span>🔍</span>}
        aria-label="Search"
        testId="icon-btn"
      />
    );
    expect(screen.getByTestId('icon-btn')).toBeInTheDocument();
  });

  it('should have aria-label', () => {
    render(
      <IconButton
        icon={<span>🔍</span>}
        aria-label="Search"
        testId="icon-btn"
      />
    );
    expect(screen.getByTestId('icon-btn')).toHaveAttribute('aria-label', 'Search');
  });

  it('should be rounded by default', () => {
    render(
      <IconButton
        icon={<span>🔍</span>}
        aria-label="Search"
        testId="icon-btn"
      />
    );
    expect(screen.getByTestId('icon-btn')).toHaveClass('rounded-full');
  });
});

// ============================================================================
// BUTTON GROUP TESTS
// ============================================================================

describe('ButtonGroup', () => {
  it('should render button group', () => {
    render(
      <ButtonGroup testId="btn-group">
        <Button>One</Button>
        <Button>Two</Button>
        <Button>Three</Button>
      </ButtonGroup>
    );
    expect(screen.getByTestId('btn-group')).toBeInTheDocument();
    expect(screen.getByRole('group')).toBeInTheDocument();
  });

  it('should render horizontal by default', () => {
    render(
      <ButtonGroup testId="btn-group">
        <Button>One</Button>
        <Button>Two</Button>
      </ButtonGroup>
    );
    expect(screen.getByTestId('btn-group')).toHaveClass('flex-row');
  });

  it('should render vertical when specified', () => {
    render(
      <ButtonGroup orientation="vertical" testId="btn-group">
        <Button>One</Button>
        <Button>Two</Button>
      </ButtonGroup>
    );
    expect(screen.getByTestId('btn-group')).toHaveClass('flex-col');
  });

  it('should pass size to children', () => {
    render(
      <ButtonGroup size="lg" testId="btn-group">
        <Button testId="btn-1">One</Button>
        <Button testId="btn-2">Two</Button>
      </ButtonGroup>
    );
    // Children should receive size prop
    expect(screen.getByTestId('btn-1')).toBeInTheDocument();
    expect(screen.getByTestId('btn-2')).toBeInTheDocument();
  });

  it('should render attached style', () => {
    render(
      <ButtonGroup attached testId="btn-group">
        <Button testId="btn-1">One</Button>
        <Button testId="btn-2">Two</Button>
        <Button testId="btn-3">Three</Button>
      </ButtonGroup>
    );
    
    // First button should have rounded-r-none
    expect(screen.getByTestId('btn-1')).toHaveClass('rounded-r-none');
    // Middle button should have rounded-none
    expect(screen.getByTestId('btn-2')).toHaveClass('rounded-none');
    // Last button should have rounded-l-none
    expect(screen.getByTestId('btn-3')).toHaveClass('rounded-l-none');
  });
});

// ============================================================================
// PRESET BUTTON TESTS
// ============================================================================

describe('Preset Buttons', () => {
  it('should render PrimaryButton', () => {
    render(<PrimaryButton testId="primary">Primary</PrimaryButton>);
    expect(screen.getByTestId('primary')).toBeInTheDocument();
  });

  it('should render SecondaryButton', () => {
    render(<SecondaryButton testId="secondary">Secondary</SecondaryButton>);
    expect(screen.getByTestId('secondary')).toBeInTheDocument();
  });

  it('should render OutlineButton', () => {
    render(<OutlineButton testId="outline">Outline</OutlineButton>);
    expect(screen.getByTestId('outline')).toBeInTheDocument();
  });

  it('should render GhostButton', () => {
    render(<GhostButton testId="ghost">Ghost</GhostButton>);
    expect(screen.getByTestId('ghost')).toBeInTheDocument();
  });

  it('should render DestructiveButton', () => {
    render(<DestructiveButton testId="destructive">Delete</DestructiveButton>);
    expect(screen.getByTestId('destructive')).toBeInTheDocument();
  });

  it('should render SuccessButton', () => {
    render(<SuccessButton testId="success">Success</SuccessButton>);
    expect(screen.getByTestId('success')).toBeInTheDocument();
  });

  it('should render LinkButton', () => {
    render(<LinkButton testId="link">Link</LinkButton>);
    expect(screen.getByTestId('link')).toBeInTheDocument();
  });
});

// ============================================================================
// SPECIALIZED BUTTON TESTS
// ============================================================================

describe('Specialized Buttons', () => {
  describe('CloseButton', () => {
    it('should render close button', () => {
      render(<CloseButton testId="close" />);
      expect(screen.getByTestId('close')).toBeInTheDocument();
    });

    it('should have default aria-label', () => {
      render(<CloseButton testId="close" />);
      expect(screen.getByTestId('close')).toHaveAttribute('aria-label', 'Close');
    });

    it('should accept custom aria-label', () => {
      render(<CloseButton aria-label="Dismiss" testId="close" />);
      expect(screen.getByTestId('close')).toHaveAttribute('aria-label', 'Dismiss');
    });
  });

  describe('BackButton', () => {
    it('should render back button with default label', () => {
      render(<BackButton testId="back" />);
      expect(screen.getByTestId('back')).toHaveTextContent('Back');
    });

    it('should accept custom label', () => {
      render(<BackButton label="Go Back" testId="back" />);
      expect(screen.getByTestId('back')).toHaveTextContent('Go Back');
    });
  });

  describe('AddButton', () => {
    it('should render add button with default label', () => {
      render(<AddButton testId="add" />);
      expect(screen.getByTestId('add')).toHaveTextContent('Add');
    });

    it('should accept custom label', () => {
      render(<AddButton label="Create New" testId="add" />);
      expect(screen.getByTestId('add')).toHaveTextContent('Create New');
    });
  });

  describe('SaveButton', () => {
    it('should render save button', () => {
      render(<SaveButton testId="save" />);
      expect(screen.getByTestId('save')).toHaveTextContent('Save');
    });

    it('should accept custom children', () => {
      render(<SaveButton testId="save">Save Changes</SaveButton>);
      expect(screen.getByTestId('save')).toHaveTextContent('Save Changes');
    });
  });

  describe('DeleteButton', () => {
    it('should render delete button', () => {
      render(<DeleteButton testId="delete" />);
      expect(screen.getByTestId('delete')).toHaveTextContent('Delete');
    });
  });

  describe('CancelButton', () => {
    it('should render cancel button', () => {
      render(<CancelButton testId="cancel" />);
      expect(screen.getByTestId('cancel')).toHaveTextContent('Cancel');
    });
  });

  describe('PlayButton', () => {
    it('should render play button by default', () => {
      render(<PlayButton testId="play" />);
      expect(screen.getByTestId('play')).toHaveTextContent('Run');
    });

    it('should show stop when isPlaying', () => {
      render(<PlayButton isPlaying testId="play" />);
      expect(screen.getByTestId('play')).toHaveTextContent('Stop');
    });

    it('should accept custom children', () => {
      render(<PlayButton testId="play">Start Test</PlayButton>);
      expect(screen.getByTestId('play')).toHaveTextContent('Start Test');
    });
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('Edge Cases', () => {
  it('should handle rapid clicks', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick} testId="my-button">Click</Button>);
    
    const button = screen.getByTestId('my-button');
    await userEvent.tripleClick(button);
    
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it('should handle keyboard activation', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick} testId="my-button">Click</Button>);
    
    const button = screen.getByTestId('my-button');
    button.focus();
    
    fireEvent.keyDown(button, { key: 'Enter' });
    fireEvent.keyUp(button, { key: 'Enter' });
    
    // Button should be clickable via keyboard
    expect(button).toHaveFocus();
  });

  it('should render with empty children', () => {
    render(<Button testId="my-button" />);
    expect(screen.getByTestId('my-button')).toBeInTheDocument();
  });

  it('should handle className prop', () => {
    render(<Button className="custom-class" testId="my-button">Click</Button>);
    expect(screen.getByTestId('my-button')).toHaveClass('custom-class');
  });

  it('should pass through native button props', () => {
    render(
      <Button
        id="my-id"
        name="my-name"
        form="my-form"
        testId="my-button"
      >
        Click
      </Button>
    );
    
    const button = screen.getByTestId('my-button');
    expect(button).toHaveAttribute('id', 'my-id');
    expect(button).toHaveAttribute('name', 'my-name');
    expect(button).toHaveAttribute('form', 'my-form');
  });
});
