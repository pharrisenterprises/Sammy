/**
 * PopupApp Test Suite
 * @module ui/popup/PopupApp.test
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import {
  PopupApp,
  POPUP_VIEWS,
  POPUP_DIMENSIONS,
  STATUS_COLORS,
} from './PopupApp';

// Extend expect with jest-dom matchers
expect.extend(matchers);

// ============================================================================
// MOCK SETUP
// ============================================================================

function createMockSendMessage(responses: Record<string, unknown> = {}) {
  return vi.fn().mockImplementation(async (type: string) => {
    if (responses[type]) {
      return responses[type];
    }
    
    // Default responses
    switch (type) {
      case 'GET_STATUS':
        return {
          recordingState: 'idle',
          replayState: 'idle',
        };
      case 'GET_TEST_COUNT':
        return { count: 3 };
      case 'START_RECORDING':
        return { success: true };
      case 'STOP_RECORDING':
        return { success: true };
      case 'PAUSE_RECORDING':
        return { success: true };
      case 'RESUME_RECORDING':
        return { success: true };
      default:
        return {};
    }
  });
}

// ============================================================================
// CONSTANT TESTS
// ============================================================================

describe('PopupApp constants', () => {
  it('should have popup views', () => {
    expect(POPUP_VIEWS.HOME).toBe('home');
    expect(POPUP_VIEWS.TESTS).toBe('tests');
    expect(POPUP_VIEWS.RECORDING).toBe('recording');
    expect(POPUP_VIEWS.SETTINGS).toBe('settings');
  });
  
  it('should have popup dimensions', () => {
    expect(POPUP_DIMENSIONS.width).toBe(360);
    expect(POPUP_DIMENSIONS.minHeight).toBe(400);
  });
  
  it('should have status colors', () => {
    expect(STATUS_COLORS.recording).toBeDefined();
    expect(STATUS_COLORS.idle).toBeDefined();
  });
});

// ============================================================================
// RENDER TESTS
// ============================================================================

describe('PopupApp rendering', () => {
  it('should render popup container', async () => {
    const sendMessage = createMockSendMessage();
    
    render(<PopupApp sendMessage={sendMessage} />);
    
    await waitFor(() => {
      expect(screen.getByTestId('popup-app')).toBeInTheDocument();
    });
  });
  
  it('should render header with logo', async () => {
    const sendMessage = createMockSendMessage();
    
    render(<PopupApp sendMessage={sendMessage} />);
    
    await waitFor(() => {
      expect(screen.getByText('Copilot')).toBeInTheDocument();
    });
  });
  
  it('should render settings button', async () => {
    const sendMessage = createMockSendMessage();
    
    render(<PopupApp sendMessage={sendMessage} />);
    
    await waitFor(() => {
      expect(screen.getByTestId('settings-button')).toBeInTheDocument();
    });
  });
  
  it('should render footer', async () => {
    const sendMessage = createMockSendMessage();
    
    render(<PopupApp sendMessage={sendMessage} />);
    
    await waitFor(() => {
      expect(screen.getByText(/Copilot Test Recorder/)).toBeInTheDocument();
    });
  });
  
  it('should show loading overlay initially', () => {
    const sendMessage = createMockSendMessage();
    
    render(<PopupApp sendMessage={sendMessage} />);
    
    expect(screen.getByTestId('loading-overlay')).toBeInTheDocument();
  });
  
  it('should hide loading overlay after load', async () => {
    const sendMessage = createMockSendMessage();
    
    render(<PopupApp sendMessage={sendMessage} />);
    
    await waitFor(() => {
      expect(screen.queryByTestId('loading-overlay')).not.toBeInTheDocument();
    });
  });
});

// ============================================================================
// HOME VIEW TESTS
// ============================================================================

describe('PopupApp home view', () => {
  it('should render quick actions', async () => {
    const sendMessage = createMockSendMessage();
    
    render(<PopupApp sendMessage={sendMessage} />);
    
    await waitFor(() => {
      expect(screen.getByTestId('action-record')).toBeInTheDocument();
      expect(screen.getByTestId('action-tests')).toBeInTheDocument();
      expect(screen.getByTestId('action-replay')).toBeInTheDocument();
      expect(screen.getByTestId('action-settings')).toBeInTheDocument();
    });
  });
  
  it('should show status as ready when idle', async () => {
    const sendMessage = createMockSendMessage();
    
    render(<PopupApp sendMessage={sendMessage} />);
    
    await waitFor(() => {
      expect(screen.getByText('Ready')).toBeInTheDocument();
    });
  });
  
  it('should show test case count', async () => {
    const sendMessage = createMockSendMessage({
      GET_TEST_COUNT: { count: 5 },
    });
    
    render(<PopupApp sendMessage={sendMessage} />);
    
    await waitFor(() => {
      expect(screen.getByText(/Recent Tests \(5\)/)).toBeInTheDocument();
    });
  });
  
  it('should show empty state when no tests', async () => {
    const sendMessage = createMockSendMessage({
      GET_TEST_COUNT: { count: 0 },
    });
    
    render(<PopupApp sendMessage={sendMessage} />);
    
    await waitFor(() => {
      expect(screen.getByText(/No tests recorded/)).toBeInTheDocument();
    });
  });
});

// ============================================================================
// RECORDING TESTS
// ============================================================================

describe('PopupApp recording', () => {
  it('should start recording on button click', async () => {
    const sendMessage = createMockSendMessage();
    const onRecordingAction = vi.fn();
    
    render(
      <PopupApp
        sendMessage={sendMessage}
        onRecordingAction={onRecordingAction}
      />
    );
    
    await waitFor(() => {
      expect(screen.getByTestId('action-record')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByTestId('action-record'));
    
    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith('START_RECORDING', expect.any(Object));
      expect(onRecordingAction).toHaveBeenCalledWith('start');
    });
  });
  
  it('should show recording view when recording', async () => {
    const sendMessage = createMockSendMessage({
      GET_STATUS: { recordingState: 'recording' },
    });
    
    render(<PopupApp sendMessage={sendMessage} initialView="recording" />);
    
    await waitFor(() => {
      expect(screen.getByText(/Recording\.\.\./)).toBeInTheDocument();
    });
  });
  
  it('should show stop recording button', async () => {
    const sendMessage = createMockSendMessage();
    
    render(<PopupApp sendMessage={sendMessage} initialView="recording" />);
    
    await waitFor(() => {
      expect(screen.getByTestId('stop-recording')).toBeInTheDocument();
    });
  });
  
  it('should show pause button when recording', async () => {
    const sendMessage = createMockSendMessage({
      GET_STATUS: { recordingState: 'recording' },
    });
    
    render(<PopupApp sendMessage={sendMessage} initialView="recording" />);
    
    await waitFor(() => {
      expect(screen.getByTestId('pause-recording')).toBeInTheDocument();
    });
  });
  
  it('should show resume button when paused', async () => {
    const sendMessage = createMockSendMessage({
      GET_STATUS: { recordingState: 'paused' },
    });
    
    render(<PopupApp sendMessage={sendMessage} initialView="recording" />);
    
    await waitFor(() => {
      expect(screen.getByTestId('resume-recording')).toBeInTheDocument();
    });
  });
  
  it('should stop recording and return to home', async () => {
    const sendMessage = createMockSendMessage();
    const onRecordingAction = vi.fn();
    
    render(
      <PopupApp
        sendMessage={sendMessage}
        initialView="recording"
        onRecordingAction={onRecordingAction}
      />
    );
    
    await waitFor(() => {
      expect(screen.getByTestId('stop-recording')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByTestId('stop-recording'));
    
    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith('STOP_RECORDING');
      expect(onRecordingAction).toHaveBeenCalledWith('stop');
    });
  });
});

// ============================================================================
// NAVIGATION TESTS
// ============================================================================

describe('PopupApp navigation', () => {
  it('should navigate to tests view', async () => {
    const sendMessage = createMockSendMessage();
    const onViewChange = vi.fn();
    
    render(
      <PopupApp
        sendMessage={sendMessage}
        onViewChange={onViewChange}
      />
    );
    
    await waitFor(() => {
      expect(screen.getByTestId('action-tests')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByTestId('action-tests'));
    
    expect(onViewChange).toHaveBeenCalledWith('tests');
  });
  
  it('should navigate to settings view', async () => {
    const sendMessage = createMockSendMessage();
    const onViewChange = vi.fn();
    
    render(
      <PopupApp
        sendMessage={sendMessage}
        onViewChange={onViewChange}
      />
    );
    
    await waitFor(() => {
      expect(screen.getByTestId('settings-button')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByTestId('settings-button'));
    
    expect(onViewChange).toHaveBeenCalledWith('settings');
  });
  
  it('should show back button in tests view', async () => {
    const sendMessage = createMockSendMessage();
    
    render(<PopupApp sendMessage={sendMessage} initialView="tests" />);
    
    await waitFor(() => {
      expect(screen.getByTestId('back-home')).toBeInTheDocument();
    });
  });
  
  it('should navigate back to home', async () => {
    const sendMessage = createMockSendMessage();
    const onViewChange = vi.fn();
    
    render(
      <PopupApp
        sendMessage={sendMessage}
        initialView="tests"
        onViewChange={onViewChange}
      />
    );
    
    await waitFor(() => {
      expect(screen.getByTestId('back-home')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByTestId('back-home'));
    
    expect(onViewChange).toHaveBeenCalledWith('home');
  });
});

// ============================================================================
// ERROR HANDLING TESTS
// ============================================================================

describe('PopupApp error handling', () => {
  it('should show error when connection fails', async () => {
    const sendMessage = vi.fn().mockRejectedValue(new Error('Connection failed'));
    
    render(<PopupApp sendMessage={sendMessage} />);
    
    await waitFor(() => {
      expect(screen.getByTestId('error-banner')).toBeInTheDocument();
    });
  });
  
  it('should show error when start recording fails', async () => {
    const sendMessage = createMockSendMessage();
    sendMessage.mockImplementation(async (type: string) => {
      if (type === 'START_RECORDING') {
        throw new Error('Recording failed');
      }
      if (type === 'GET_STATUS') {
        return { recordingState: 'idle' };
      }
      if (type === 'GET_TEST_COUNT') {
        return { count: 0 };
      }
      return {};
    });
    
    render(<PopupApp sendMessage={sendMessage} />);
    
    await waitFor(() => {
      expect(screen.getByTestId('action-record')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByTestId('action-record'));
    
    await waitFor(() => {
      expect(screen.getByTestId('error-banner')).toBeInTheDocument();
      expect(screen.getByText(/Recording failed/)).toBeInTheDocument();
    });
  });
  
  it('should dismiss error on click', async () => {
    const sendMessage = vi.fn().mockRejectedValue(new Error('Error'));
    
    render(<PopupApp sendMessage={sendMessage} />);
    
    await waitFor(() => {
      expect(screen.getByTestId('error-banner')).toBeInTheDocument();
    });
    
    // Click dismiss button (the ✕ button inside error banner)
    const errorBanner = screen.getByTestId('error-banner');
    const dismissButton = errorBanner.querySelector('button');
    
    if (dismissButton) {
      fireEvent.click(dismissButton);
    }
    
    await waitFor(() => {
      expect(screen.queryByTestId('error-banner')).not.toBeInTheDocument();
    });
  });
});

// ============================================================================
// STATUS TESTS
// ============================================================================

describe('PopupApp status', () => {
  it('should show recording status', async () => {
    const sendMessage = createMockSendMessage({
      GET_STATUS: { recordingState: 'recording' },
    });
    
    render(<PopupApp sendMessage={sendMessage} />);
    
    await waitFor(() => {
      expect(screen.getByText(/Recording in progress/)).toBeInTheDocument();
    });
  });
  
  it('should show paused status', async () => {
    const sendMessage = createMockSendMessage({
      GET_STATUS: { recordingState: 'paused' },
    });
    
    render(<PopupApp sendMessage={sendMessage} />);
    
    await waitFor(() => {
      expect(screen.getByText(/paused/i)).toBeInTheDocument();
    });
  });
  
  it('should disable record button when recording', async () => {
    const sendMessage = createMockSendMessage({
      GET_STATUS: { recordingState: 'recording' },
    });
    
    render(<PopupApp sendMessage={sendMessage} />);
    
    await waitFor(() => {
      const recordButton = screen.getByTestId('action-record');
      expect(recordButton).toBeDisabled();
    });
  });
});

// ============================================================================
// INITIAL VIEW TESTS
// ============================================================================

describe('PopupApp initial view', () => {
  it('should start with home view by default', async () => {
    const sendMessage = createMockSendMessage();
    
    render(<PopupApp sendMessage={sendMessage} />);
    
    await waitFor(() => {
      expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    });
  });
  
  it('should start with specified initial view', async () => {
    const sendMessage = createMockSendMessage();
    
    render(<PopupApp sendMessage={sendMessage} initialView="settings" />);
    
    await waitFor(() => {
      expect(screen.getByText(/Settings/)).toBeInTheDocument();
    });
  });
});
