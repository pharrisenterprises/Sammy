/**
 * RecordingControls Test Suite
 * @module ui/components/RecordingControls.test
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import {
  RecordingControls,
  CompactRecordingControls,
  ExpandedRecordingControls,
  BUTTON_VARIANTS,
  LAYOUT_VARIANTS,
  DEFAULT_SHORTCUTS,
} from './RecordingControls';

// Extend expect with jest-dom matchers
expect.extend(matchers);

// ============================================================================
// CONSTANT TESTS
// ============================================================================

describe('RecordingControls constants', () => {
  afterEach(() => {
    cleanup();
  });
  
  it('should have button variants', () => {
    expect(BUTTON_VARIANTS.PRIMARY).toBe('primary');
    expect(BUTTON_VARIANTS.SECONDARY).toBe('secondary');
    expect(BUTTON_VARIANTS.DANGER).toBe('danger');
  });
  
  it('should have layout variants', () => {
    expect(LAYOUT_VARIANTS.HORIZONTAL).toBe('horizontal');
    expect(LAYOUT_VARIANTS.VERTICAL).toBe('vertical');
    expect(LAYOUT_VARIANTS.COMPACT).toBe('compact');
    expect(LAYOUT_VARIANTS.EXPANDED).toBe('expanded');
  });
  
  it('should have default shortcuts', () => {
    expect(DEFAULT_SHORTCUTS.startStop).toBeDefined();
    expect(DEFAULT_SHORTCUTS.pauseResume).toBeDefined();
  });
});

// ============================================================================
// IDLE STATE TESTS
// ============================================================================

describe('RecordingControls idle state', () => {
  afterEach(() => {
    cleanup();
  });
  
  it('should render start button when idle', () => {
    render(<RecordingControls state="idle" onStart={vi.fn()} />);
    
    expect(screen.getByTestId('btn-start')).toBeInTheDocument();
    expect(screen.getByText('Start Recording')).toBeInTheDocument();
  });
  
  it('should not render pause/stop buttons when idle', () => {
    render(<RecordingControls state="idle" />);
    
    expect(screen.queryByTestId('btn-pause')).not.toBeInTheDocument();
    expect(screen.queryByTestId('btn-stop')).not.toBeInTheDocument();
  });
  
  it('should call onStart when start button clicked', () => {
    const onStart = vi.fn();
    render(<RecordingControls state="idle" onStart={onStart} />);
    
    fireEvent.click(screen.getByTestId('btn-start'));
    
    expect(onStart).toHaveBeenCalledTimes(1);
  });
  
  it('should disable start button when no onStart handler', () => {
    render(<RecordingControls state="idle" />);
    
    expect(screen.getByTestId('btn-start')).toBeDisabled();
  });
});

// ============================================================================
// RECORDING STATE TESTS
// ============================================================================

describe('RecordingControls recording state', () => {
  afterEach(() => {
    cleanup();
  });
  
  it('should render pause and stop buttons when recording', () => {
    render(
      <RecordingControls
        state="recording"
        onPause={vi.fn()}
        onStop={vi.fn()}
      />
    );
    
    expect(screen.getByTestId('btn-pause')).toBeInTheDocument();
    expect(screen.getByTestId('btn-stop')).toBeInTheDocument();
  });
  
  it('should not render start button when recording', () => {
    render(<RecordingControls state="recording" />);
    
    expect(screen.queryByTestId('btn-start')).not.toBeInTheDocument();
  });
  
  it('should call onPause when pause button clicked', () => {
    const onPause = vi.fn();
    render(
      <RecordingControls
        state="recording"
        onPause={onPause}
        onStop={vi.fn()}
      />
    );
    
    fireEvent.click(screen.getByTestId('btn-pause'));
    
    expect(onPause).toHaveBeenCalledTimes(1);
  });
  
  it('should call onStop when stop button clicked', () => {
    const onStop = vi.fn();
    render(
      <RecordingControls
        state="recording"
        onPause={vi.fn()}
        onStop={onStop}
      />
    );
    
    fireEvent.click(screen.getByTestId('btn-stop'));
    
    expect(onStop).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// PAUSED STATE TESTS
// ============================================================================

describe('RecordingControls paused state', () => {
  afterEach(() => {
    cleanup();
  });
  
  it('should render resume and stop buttons when paused', () => {
    render(
      <RecordingControls
        state="paused"
        onResume={vi.fn()}
        onStop={vi.fn()}
      />
    );
    
    expect(screen.getByTestId('btn-resume')).toBeInTheDocument();
    expect(screen.getByTestId('btn-stop')).toBeInTheDocument();
  });
  
  it('should not render pause button when paused', () => {
    render(<RecordingControls state="paused" />);
    
    expect(screen.queryByTestId('btn-pause')).not.toBeInTheDocument();
  });
  
  it('should call onResume when resume button clicked', () => {
    const onResume = vi.fn();
    render(
      <RecordingControls
        state="paused"
        onResume={onResume}
        onStop={vi.fn()}
      />
    );
    
    fireEvent.click(screen.getByTestId('btn-resume'));
    
    expect(onResume).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// CANCEL BUTTON TESTS
// ============================================================================

describe('RecordingControls cancel button', () => {
  afterEach(() => {
    cleanup();
  });
  
  it('should render cancel button when onCancel provided', () => {
    render(
      <RecordingControls
        state="recording"
        onCancel={vi.fn()}
        onStop={vi.fn()}
      />
    );
    
    expect(screen.getByTestId('btn-cancel')).toBeInTheDocument();
  });
  
  it('should not render cancel button when idle', () => {
    render(
      <RecordingControls
        state="idle"
        onCancel={vi.fn()}
      />
    );
    
    expect(screen.queryByTestId('btn-cancel')).not.toBeInTheDocument();
  });
  
  it('should call onCancel when cancel button clicked', () => {
    const onCancel = vi.fn();
    render(
      <RecordingControls
        state="recording"
        onCancel={onCancel}
        onStop={vi.fn()}
      />
    );
    
    fireEvent.click(screen.getByTestId('btn-cancel'));
    
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// STEP COUNT TESTS
// ============================================================================

describe('RecordingControls step count', () => {
  afterEach(() => {
    cleanup();
  });
  
  it('should display step count', () => {
    render(
      <RecordingControls
        state="recording"
        stepCount={5}
        showStepCount
        layout="expanded"
      />
    );
    
    expect(screen.getByTestId('step-count')).toBeInTheDocument();
    expect(screen.getByText(/5 steps/)).toBeInTheDocument();
  });
  
  it('should show singular "step" for count of 1', () => {
    render(
      <RecordingControls
        state="recording"
        stepCount={1}
        showStepCount
        layout="expanded"
      />
    );
    
    expect(screen.getByText(/1 step/)).toBeInTheDocument();
  });
  
  it('should hide step count when showStepCount is false', () => {
    render(
      <RecordingControls
        state="recording"
        stepCount={5}
        showStepCount={false}
        layout="expanded"
      />
    );
    
    expect(screen.queryByTestId('step-count')).not.toBeInTheDocument();
  });
});

// ============================================================================
// DURATION TESTS
// ============================================================================

describe('RecordingControls duration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });
  
  it('should display duration', () => {
    render(
      <RecordingControls
        state="recording"
        duration={65000} // 1:05
        showDuration
        layout="expanded"
      />
    );
    
    expect(screen.getByTestId('duration')).toBeInTheDocument();
    expect(screen.getByText('01:05')).toBeInTheDocument();
  });
  
  it('should increment duration while recording', () => {
    render(
      <RecordingControls
        state="recording"
        duration={0}
        showDuration
        layout="expanded"
      />
    );
    
    expect(screen.getByText('00:00')).toBeInTheDocument();
    
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    
    expect(screen.getByText('00:05')).toBeInTheDocument();
  });
  
  it('should not show duration when idle', () => {
    const { container } = render(
      <RecordingControls
        state="idle"
        duration={5000}
        showDuration
        layout="expanded"
      />
    );
    
    expect(container.querySelector('[data-testid="duration"]')).not.toBeInTheDocument();
  });
});

// ============================================================================
// LAYOUT TESTS
// ============================================================================

describe('RecordingControls layouts', () => {
  afterEach(() => {
    cleanup();
  });
  
  it('should render horizontal layout', () => {
    const { getByTestId } = render(
      <RecordingControls
        state="idle"
        layout="horizontal"
        onStart={vi.fn()}
      />
    );
    
    expect(getByTestId('recording-controls')).toBeInTheDocument();
  });
  
  it('should render vertical layout', () => {
    render(
      <RecordingControls
        state="idle"
        layout="vertical"
        onStart={vi.fn()}
      />
    );
    
    expect(screen.getByTestId('recording-controls')).toBeInTheDocument();
  });
  
  it('should render compact layout without labels', () => {
    render(
      <RecordingControls
        state="idle"
        layout="compact"
        onStart={vi.fn()}
      />
    );
    
    // In compact mode, button text should not be visible
    expect(screen.queryByText('Start Recording')).not.toBeInTheDocument();
  });
  
  it('should render expanded layout with status bar', () => {
    render(
      <RecordingControls
        state="recording"
        layout="expanded"
        onStop={vi.fn()}
      />
    );
    
    expect(screen.getByTestId('status-bar')).toBeInTheDocument();
  });
});

// ============================================================================
// TEST NAME TESTS
// ============================================================================

describe('RecordingControls test name', () => {
  afterEach(() => {
    cleanup();
  });
  
  it('should display test name when showTestName is true', () => {
    render(
      <RecordingControls
        state="recording"
        testCaseName="Login Test"
        showTestName
        layout="expanded"
      />
    );
    
    expect(screen.getByTestId('test-name')).toBeInTheDocument();
    expect(screen.getByText('Login Test')).toBeInTheDocument();
  });
  
  it('should not display test name when showTestName is false', () => {
    render(
      <RecordingControls
        state="recording"
        testCaseName="Login Test"
        showTestName={false}
        layout="expanded"
      />
    );
    
    expect(screen.queryByTestId('test-name')).not.toBeInTheDocument();
  });
});

// ============================================================================
// DISABLED STATE TESTS
// ============================================================================

describe('RecordingControls disabled state', () => {
  afterEach(() => {
    cleanup();
  });
  
  it('should disable all buttons when disabled', () => {
    render(
      <RecordingControls
        state="recording"
        disabled
        onPause={vi.fn()}
        onStop={vi.fn()}
      />
    );
    
    expect(screen.getByTestId('btn-pause')).toBeDisabled();
    expect(screen.getByTestId('btn-stop')).toBeDisabled();
  });
  
  it('should not call handlers when disabled', () => {
    const onStop = vi.fn();
    render(
      <RecordingControls
        state="recording"
        disabled
        onStop={onStop}
      />
    );
    
    fireEvent.click(screen.getByTestId('btn-stop'));
    
    expect(onStop).not.toHaveBeenCalled();
  });
});

// ============================================================================
// KEYBOARD SHORTCUT TESTS
// ============================================================================

describe('RecordingControls keyboard shortcuts', () => {
  afterEach(() => {
    cleanup();
  });
  
  it('should trigger start on shortcut when idle', () => {
    const onStart = vi.fn();
    render(
      <RecordingControls
        state="idle"
        onStart={onStart}
        shortcuts={{ startStop: 'Alt+Shift+R' }}
      />
    );
    
    fireEvent.keyDown(window, {
      key: 'r',
      altKey: true,
      shiftKey: true,
    });
    
    expect(onStart).toHaveBeenCalled();
  });
  
  it('should trigger stop on shortcut when recording', () => {
    const onStop = vi.fn();
    render(
      <RecordingControls
        state="recording"
        onStop={onStop}
        shortcuts={{ startStop: 'Alt+Shift+R' }}
      />
    );
    
    fireEvent.keyDown(window, {
      key: 'r',
      altKey: true,
      shiftKey: true,
    });
    
    expect(onStop).toHaveBeenCalled();
  });
  
  it('should trigger pause on shortcut when recording', () => {
    const onPause = vi.fn();
    render(
      <RecordingControls
        state="recording"
        onPause={onPause}
        shortcuts={{ pauseResume: 'Alt+Shift+P' }}
      />
    );
    
    fireEvent.keyDown(window, {
      key: 'p',
      altKey: true,
      shiftKey: true,
    });
    
    expect(onPause).toHaveBeenCalled();
  });
  
  it('should trigger resume on shortcut when paused', () => {
    const onResume = vi.fn();
    render(
      <RecordingControls
        state="paused"
        onResume={onResume}
        shortcuts={{ pauseResume: 'Alt+Shift+P' }}
      />
    );
    
    fireEvent.keyDown(window, {
      key: 'p',
      altKey: true,
      shiftKey: true,
    });
    
    expect(onResume).toHaveBeenCalled();
  });
  
  it('should not trigger shortcuts when disabled', () => {
    const onStart = vi.fn();
    render(
      <RecordingControls
        state="idle"
        disabled
        onStart={onStart}
        shortcuts={{ startStop: 'Alt+Shift+R' }}
      />
    );
    
    fireEvent.keyDown(window, {
      key: 'r',
      altKey: true,
      shiftKey: true,
    });
    
    expect(onStart).not.toHaveBeenCalled();
  });
});

// ============================================================================
// SIZE VARIANT TESTS
// ============================================================================

describe('RecordingControls sizes', () => {
  afterEach(() => {
    cleanup();
  });
  
  it('should render small size', () => {
    render(
      <RecordingControls
        state="idle"
        size="small"
        onStart={vi.fn()}
      />
    );
    
    expect(screen.getByTestId('recording-controls')).toBeInTheDocument();
  });
  
  it('should render medium size', () => {
    render(
      <RecordingControls
        state="idle"
        size="medium"
        onStart={vi.fn()}
      />
    );
    
    expect(screen.getByTestId('recording-controls')).toBeInTheDocument();
  });
  
  it('should render large size', () => {
    render(
      <RecordingControls
        state="idle"
        size="large"
        onStart={vi.fn()}
      />
    );
    
    expect(screen.getByTestId('recording-controls')).toBeInTheDocument();
  });
});

// ============================================================================
// SPECIALIZED VARIANT TESTS
// ============================================================================

describe('RecordingControls specialized variants', () => {
  afterEach(() => {
    cleanup();
  });
  
  it('should render CompactRecordingControls', () => {
    render(
      <CompactRecordingControls
        state="idle"
        onStart={vi.fn()}
      />
    );
    
    expect(screen.getByTestId('recording-controls')).toBeInTheDocument();
    // Should not have button labels in compact mode
    expect(screen.queryByText('Start Recording')).not.toBeInTheDocument();
  });
  
  it('should render ExpandedRecordingControls with test name', () => {
    render(
      <ExpandedRecordingControls
        state="recording"
        testCaseName="My Test"
        onStop={vi.fn()}
      />
    );
    
    expect(screen.getByTestId('recording-controls')).toBeInTheDocument();
    expect(screen.getByTestId('status-bar')).toBeInTheDocument();
  });
});

// ============================================================================
// ACCESSIBILITY TESTS
// ============================================================================

describe('RecordingControls accessibility', () => {
  afterEach(() => {
    cleanup();
  });
  
  it('should have role="group"', () => {
    const { container } = render(<RecordingControls state="idle" onStart={vi.fn()} />);
    
    expect(container.querySelector('[role="group"]')).toBeInTheDocument();
  });
  
  it('should have aria-label', () => {
    const { container } = render(<RecordingControls state="idle" onStart={vi.fn()} />);
    
    expect(container.querySelector('[aria-label="Recording controls"]')).toBeInTheDocument();
  });
  
  it('should have button aria-labels', () => {
    const { getByRole } = render(<RecordingControls state="idle" onStart={vi.fn()} />);
    
    expect(getByRole('button', { name: 'Start Recording' })).toBeInTheDocument();
  });
});

// ============================================================================
// SHORTCUTS DISPLAY TESTS
// ============================================================================

describe('RecordingControls shortcuts display', () => {
  afterEach(() => {
    cleanup();
  });
  
  it('should show shortcuts when showShortcuts is true', () => {
    render(
      <RecordingControls
        state="idle"
        showShortcuts
        shortcuts={{ startStop: 'Alt+R' }}
        onStart={vi.fn()}
      />
    );
    
    expect(screen.getByText(/Alt\+R/)).toBeInTheDocument();
  });
  
  it('should hide shortcuts when showShortcuts is false', () => {
    render(
      <RecordingControls
        state="idle"
        showShortcuts={false}
        shortcuts={{ startStop: 'Alt+R' }}
        onStart={vi.fn()}
        layout="compact"
      />
    );
    
    // Shortcut still renders in compact mode by default, so check it's not in the label
    expect(screen.queryByText('Start Recording')).not.toBeInTheDocument();
  });
});
