/**
 * Tooltip Component Tests
 * @module components/Ui/Tooltip.test
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  Tooltip,
  TooltipProvider,
  SimpleTooltip,
  IconTooltip,
  InfoTooltip,
  TruncatedText,
  ShortcutTooltip,
} from './Tooltip';

// ============================================================================
// SETUP
// ============================================================================

// Mock timers
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// Helper to advance timers and flush promises
const advanceTimers = async (ms: number) => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
};

// ============================================================================
// TOOLTIP TESTS
// ============================================================================

describe('Tooltip', () => {
  describe('Rendering', () => {
    it('should render trigger element', () => {
      render(
        <Tooltip content="Test tooltip">
          <button data-testid="trigger">Hover me</button>
        </Tooltip>
      );
      expect(screen.getByTestId('trigger')).toBeInTheDocument();
    });

    it('should not render tooltip content initially', () => {
      render(
        <Tooltip content="Test tooltip" testId="my-tooltip">
          <button>Hover me</button>
        </Tooltip>
      );
      expect(screen.queryByTestId('my-tooltip')).not.toBeInTheDocument();
    });

    it('should render tooltip on hover after delay', async () => {
      render(
        <Tooltip content="Test tooltip" testId="my-tooltip" delayShow={300}>
          <button data-testid="trigger">Hover me</button>
        </Tooltip>
      );

      fireEvent.mouseEnter(screen.getByTestId('trigger'));
      
      // Not visible yet
      expect(screen.queryByTestId('my-tooltip')).not.toBeInTheDocument();
      
      // Advance past delay
      await advanceTimers(350);
      
      expect(screen.getByTestId('my-tooltip')).toBeInTheDocument();
      expect(screen.getByRole('tooltip')).toHaveTextContent('Test tooltip');
    });

    it('should hide tooltip on mouse leave', async () => {
      render(
        <Tooltip content="Test tooltip" testId="my-tooltip" delayShow={0}>
          <button data-testid="trigger">Hover me</button>
        </Tooltip>
      );

      fireEvent.mouseEnter(screen.getByTestId('trigger'));
      await advanceTimers(50);
      
      expect(screen.getByTestId('my-tooltip')).toBeInTheDocument();
      
      fireEvent.mouseLeave(screen.getByTestId('trigger'));
      await advanceTimers(50);
      
      expect(screen.queryByTestId('my-tooltip')).not.toBeInTheDocument();
    });
  });

  describe('Placement', () => {
    const sides = ['top', 'bottom', 'left', 'right'] as const;

    sides.forEach((side) => {
      it(`should position tooltip on ${side}`, async () => {
        render(
          <Tooltip content="Test" side={side} testId="my-tooltip" delayShow={0}>
            <button data-testid="trigger">Trigger</button>
          </Tooltip>
        );

        fireEvent.mouseEnter(screen.getByTestId('trigger'));
        await advanceTimers(50);
        
        expect(screen.getByTestId('my-tooltip')).toBeInTheDocument();
      });
    });
  });

  describe('Variants', () => {
    const variants = ['default', 'dark', 'light', 'info', 'success', 'warning', 'error'] as const;

    variants.forEach((variant) => {
      it(`should render ${variant} variant`, async () => {
        render(
          <Tooltip content="Test" variant={variant} testId="my-tooltip" delayShow={0}>
            <button data-testid="trigger">Trigger</button>
          </Tooltip>
        );

        fireEvent.mouseEnter(screen.getByTestId('trigger'));
        await advanceTimers(50);
        
        expect(screen.getByTestId('my-tooltip')).toBeInTheDocument();
      });
    });
  });

  describe('Trigger Modes', () => {
    it('should show on hover (default)', async () => {
      render(
        <Tooltip content="Test" trigger="hover" testId="my-tooltip" delayShow={0}>
          <button data-testid="trigger">Trigger</button>
        </Tooltip>
      );

      fireEvent.mouseEnter(screen.getByTestId('trigger'));
      await advanceTimers(50);
      
      expect(screen.getByTestId('my-tooltip')).toBeInTheDocument();
    });

    it('should show on focus', async () => {
      render(
        <Tooltip content="Test" trigger="focus" testId="my-tooltip" delayShow={0}>
          <button data-testid="trigger">Trigger</button>
        </Tooltip>
      );

      fireEvent.focus(screen.getByTestId('trigger'));
      await advanceTimers(50);
      
      expect(screen.getByTestId('my-tooltip')).toBeInTheDocument();
      
      fireEvent.blur(screen.getByTestId('trigger'));
      await advanceTimers(50);
      
      expect(screen.queryByTestId('my-tooltip')).not.toBeInTheDocument();
    });

    it('should toggle on click', async () => {
      render(
        <Tooltip content="Test" trigger="click" testId="my-tooltip" delayShow={0}>
          <button data-testid="trigger">Trigger</button>
        </Tooltip>
      );

      // First click shows
      fireEvent.click(screen.getByTestId('trigger'));
      await advanceTimers(50);
      expect(screen.getByTestId('my-tooltip')).toBeInTheDocument();

      // Second click hides
      fireEvent.click(screen.getByTestId('trigger'));
      await advanceTimers(50);
      expect(screen.queryByTestId('my-tooltip')).not.toBeInTheDocument();
    });
  });

  describe('Controlled Mode', () => {
    it('should respect controlled open state', async () => {
      const { rerender } = render(
        <Tooltip content="Test" open={false} testId="my-tooltip">
          <button data-testid="trigger">Trigger</button>
        </Tooltip>
      );

      expect(screen.queryByTestId('my-tooltip')).not.toBeInTheDocument();

      rerender(
        <Tooltip content="Test" open={true} testId="my-tooltip">
          <button data-testid="trigger">Trigger</button>
        </Tooltip>
      );

      await advanceTimers(50);
      expect(screen.getByTestId('my-tooltip')).toBeInTheDocument();
    });

    it('should call onOpenChange', async () => {
      const onOpenChange = vi.fn();
      
      render(
        <Tooltip 
          content="Test" 
          onOpenChange={onOpenChange} 
          testId="my-tooltip" 
          delayShow={0}
        >
          <button data-testid="trigger">Trigger</button>
        </Tooltip>
      );

      fireEvent.mouseEnter(screen.getByTestId('trigger'));
      await advanceTimers(50);
      
      expect(onOpenChange).toHaveBeenCalledWith(true);

      fireEvent.mouseLeave(screen.getByTestId('trigger'));
      await advanceTimers(50);
      
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('Disabled State', () => {
    it('should not show when disabled', async () => {
      render(
        <Tooltip content="Test" disabled testId="my-tooltip" delayShow={0}>
          <button data-testid="trigger">Trigger</button>
        </Tooltip>
      );

      fireEvent.mouseEnter(screen.getByTestId('trigger'));
      await advanceTimers(100);
      
      expect(screen.queryByTestId('my-tooltip')).not.toBeInTheDocument();
    });

    it('should not show when content is empty', async () => {
      render(
        <Tooltip content="" testId="my-tooltip" delayShow={0}>
          <button data-testid="trigger">Trigger</button>
        </Tooltip>
      );

      fireEvent.mouseEnter(screen.getByTestId('trigger'));
      await advanceTimers(100);
      
      expect(screen.queryByTestId('my-tooltip')).not.toBeInTheDocument();
    });
  });

  describe('Arrow', () => {
    it('should show arrow by default', async () => {
      render(
        <Tooltip content="Test" testId="my-tooltip" delayShow={0}>
          <button data-testid="trigger">Trigger</button>
        </Tooltip>
      );

      fireEvent.mouseEnter(screen.getByTestId('trigger'));
      await advanceTimers(50);
      
      expect(screen.getByTestId('my-tooltip-arrow')).toBeInTheDocument();
    });

    it('should hide arrow when showArrow is false', async () => {
      render(
        <Tooltip content="Test" showArrow={false} testId="my-tooltip" delayShow={0}>
          <button data-testid="trigger">Trigger</button>
        </Tooltip>
      );

      fireEvent.mouseEnter(screen.getByTestId('trigger'));
      await advanceTimers(50);
      
      expect(screen.queryByTestId('my-tooltip-arrow')).not.toBeInTheDocument();
    });
  });

  describe('Keyboard', () => {
    it('should close on Escape key', async () => {
      render(
        <Tooltip content="Test" testId="my-tooltip" delayShow={0}>
          <button data-testid="trigger">Trigger</button>
        </Tooltip>
      );

      fireEvent.mouseEnter(screen.getByTestId('trigger'));
      await advanceTimers(50);
      
      expect(screen.getByTestId('my-tooltip')).toBeInTheDocument();

      fireEvent.keyDown(document, { key: 'Escape' });
      await advanceTimers(50);
      
      expect(screen.queryByTestId('my-tooltip')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have correct ARIA attributes', async () => {
      render(
        <Tooltip content="Test tooltip" testId="my-tooltip" delayShow={0}>
          <button data-testid="trigger">Trigger</button>
        </Tooltip>
      );

      fireEvent.mouseEnter(screen.getByTestId('trigger'));
      await advanceTimers(50);
      
      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toBeInTheDocument();
      
      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveAttribute('aria-describedby', 'my-tooltip');
    });
  });
});

// ============================================================================
// TOOLTIP PROVIDER TESTS
// ============================================================================

describe('TooltipProvider', () => {
  it('should provide default delays to children', async () => {
    render(
      <TooltipProvider delayShow={100}>
        <Tooltip content="Test" testId="my-tooltip">
          <button data-testid="trigger">Trigger</button>
        </Tooltip>
      </TooltipProvider>
    );

    fireEvent.mouseEnter(screen.getByTestId('trigger'));
    
    // Should not be visible at 50ms
    await advanceTimers(50);
    expect(screen.queryByTestId('my-tooltip')).not.toBeInTheDocument();
    
    // Should be visible after 100ms
    await advanceTimers(100);
    expect(screen.getByTestId('my-tooltip')).toBeInTheDocument();
  });

  it('should skip delay for consecutive hovers', async () => {
    render(
      <TooltipProvider delayShow={300} skipDelayDuration={500}>
        <Tooltip content="First" testId="tooltip-1">
          <button data-testid="trigger-1">First</button>
        </Tooltip>
        <Tooltip content="Second" testId="tooltip-2">
          <button data-testid="trigger-2">Second</button>
        </Tooltip>
      </TooltipProvider>
    );

    // Show first tooltip
    fireEvent.mouseEnter(screen.getByTestId('trigger-1'));
    await advanceTimers(350);
    expect(screen.getByTestId('tooltip-1')).toBeInTheDocument();

    // Hide first
    fireEvent.mouseLeave(screen.getByTestId('trigger-1'));
    await advanceTimers(10);

    // Hover second - should show immediately (skip delay)
    fireEvent.mouseEnter(screen.getByTestId('trigger-2'));
    await advanceTimers(10);
    expect(screen.getByTestId('tooltip-2')).toBeInTheDocument();
  });
});

// ============================================================================
// SIMPLE TOOLTIP TESTS
// ============================================================================

describe('SimpleTooltip', () => {
  it('should render with text', async () => {
    render(
      <SimpleTooltip text="Simple text" testId="simple-tooltip">
        <button data-testid="trigger">Trigger</button>
      </SimpleTooltip>
    );

    fireEvent.mouseEnter(screen.getByTestId('trigger'));
    await advanceTimers(350);
    
    expect(screen.getByTestId('simple-tooltip')).toHaveTextContent('Simple text');
  });

  it('should respect position prop', async () => {
    render(
      <SimpleTooltip text="Test" position="bottom" testId="simple-tooltip">
        <button data-testid="trigger">Trigger</button>
      </SimpleTooltip>
    );

    fireEvent.mouseEnter(screen.getByTestId('trigger'));
    await advanceTimers(350);
    
    expect(screen.getByTestId('simple-tooltip')).toBeInTheDocument();
  });
});

// ============================================================================
// ICON TOOLTIP TESTS
// ============================================================================

describe('IconTooltip', () => {
  it('should render with label', async () => {
    render(
      <IconTooltip label="Delete item" testId="icon-tooltip">
        <button data-testid="icon-btn">🗑️</button>
      </IconTooltip>
    );

    fireEvent.mouseEnter(screen.getByTestId('icon-btn'));
    await advanceTimers(550); // Default 500ms delay + buffer
    
    expect(screen.getByTestId('icon-tooltip')).toHaveTextContent('Delete item');
  });
});

// ============================================================================
// INFO TOOLTIP TESTS
// ============================================================================

describe('InfoTooltip', () => {
  it('should render info icon with tooltip', async () => {
    render(<InfoTooltip content="Helpful information" testId="info-tooltip" />);
    
    const button = screen.getByRole('button', { name: 'More information' });
    expect(button).toBeInTheDocument();

    fireEvent.mouseEnter(button);
    await advanceTimers(350);
    
    expect(screen.getByTestId('info-tooltip')).toHaveTextContent('Helpful information');
  });

  it('should render different icon sizes', () => {
    const { rerender } = render(<InfoTooltip content="Test" iconSize="sm" />);
    expect(screen.getByRole('button')).toBeInTheDocument();

    rerender(<InfoTooltip content="Test" iconSize="lg" />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});

// ============================================================================
// TRUNCATED TEXT TESTS
// ============================================================================

describe('TruncatedText', () => {
  it('should render text', () => {
    render(<TruncatedText text="Short text" testId="truncated" />);
    expect(screen.getByTestId('truncated')).toHaveTextContent('Short text');
  });

  it('should apply maxWidth', () => {
    render(<TruncatedText text="Some text" maxWidth={100} testId="truncated" />);
    expect(screen.getByTestId('truncated')).toHaveStyle({ maxWidth: '100px' });
  });

  it('should accept string maxWidth', () => {
    render(<TruncatedText text="Some text" maxWidth="50%" testId="truncated" />);
    expect(screen.getByTestId('truncated')).toHaveStyle({ maxWidth: '50%' });
  });
});

// ============================================================================
// SHORTCUT TOOLTIP TESTS
// ============================================================================

describe('ShortcutTooltip', () => {
  it('should render label and shortcut keys', async () => {
    render(
      <ShortcutTooltip label="Save" shortcut="Ctrl+S" testId="shortcut-tooltip">
        <button data-testid="trigger">Save</button>
      </ShortcutTooltip>
    );

    fireEvent.mouseEnter(screen.getByTestId('trigger'));
    await advanceTimers(350);
    
    const tooltip = screen.getByTestId('shortcut-tooltip');
    expect(tooltip).toHaveTextContent('Save');
    expect(tooltip).toHaveTextContent('Ctrl');
    expect(tooltip).toHaveTextContent('S');
  });

  it('should parse multi-key shortcuts', async () => {
    render(
      <ShortcutTooltip label="Undo" shortcut="Ctrl+Shift+Z" testId="shortcut-tooltip">
        <button data-testid="trigger">Undo</button>
      </ShortcutTooltip>
    );

    fireEvent.mouseEnter(screen.getByTestId('trigger'));
    await advanceTimers(350);
    
    const tooltip = screen.getByTestId('shortcut-tooltip');
    expect(tooltip).toHaveTextContent('Ctrl');
    expect(tooltip).toHaveTextContent('Shift');
    expect(tooltip).toHaveTextContent('Z');
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('Edge Cases', () => {
  it('should handle rapid hover/unhover', async () => {
    render(
      <Tooltip content="Test" testId="my-tooltip" delayShow={300}>
        <button data-testid="trigger">Trigger</button>
      </Tooltip>
    );

    // Rapid hover/unhover
    fireEvent.mouseEnter(screen.getByTestId('trigger'));
    await advanceTimers(100);
    fireEvent.mouseLeave(screen.getByTestId('trigger'));
    await advanceTimers(100);
    fireEvent.mouseEnter(screen.getByTestId('trigger'));
    await advanceTimers(100);
    fireEvent.mouseLeave(screen.getByTestId('trigger'));
    
    // Should never show
    expect(screen.queryByTestId('my-tooltip')).not.toBeInTheDocument();
  });

  it('should handle complex content', async () => {
    render(
      <Tooltip 
        content={
          <div data-testid="complex-content">
            <strong>Title</strong>
            <p>Description text</p>
          </div>
        }
        testId="my-tooltip"
        delayShow={0}
      >
        <button data-testid="trigger">Trigger</button>
      </Tooltip>
    );

    fireEvent.mouseEnter(screen.getByTestId('trigger'));
    await advanceTimers(50);
    
    expect(screen.getByTestId('complex-content')).toBeInTheDocument();
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Description text')).toBeInTheDocument();
  });

  it('should forward refs to trigger element', async () => {
    const ref = React.createRef<HTMLButtonElement>();
    
    render(
      <Tooltip content="Test">
        <button ref={ref} data-testid="trigger">Trigger</button>
      </Tooltip>
    );

    expect(ref.current).toBe(screen.getByTestId('trigger'));
  });

  it('should preserve trigger event handlers', async () => {
    const onClick = vi.fn();
    const onMouseEnter = vi.fn();
    
    render(
      <Tooltip content="Test" delayShow={0}>
        <button 
          data-testid="trigger" 
          onClick={onClick}
          onMouseEnter={onMouseEnter}
        >
          Trigger
        </button>
      </Tooltip>
    );

    fireEvent.mouseEnter(screen.getByTestId('trigger'));
    expect(onMouseEnter).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('trigger'));
    expect(onClick).toHaveBeenCalled();
  });
});
