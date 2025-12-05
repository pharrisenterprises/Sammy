/**
 * RecordingContext
 * 
 * Provides global access to recording state and operations.
 * Wraps useRecording hook.
 */

import React, { createContext, useContext, type ReactNode } from 'react';
import { useRecording, type UseRecordingReturn } from '@/hooks/useRecording';

/**
 * Recording context value type
 */
export type RecordingContextValue = UseRecordingReturn;

/**
 * Recording context
 */
const RecordingContext = createContext<RecordingContextValue | null>(null);

/**
 * Recording context provider props
 */
export interface RecordingProviderProps {
  children: ReactNode;
}

/**
 * RecordingProvider component
 * 
 * Wraps children with recording context providing access to recording state.
 * 
 * @example
 * <RecordingProvider>
 *   <RecordingUI />
 * </RecordingProvider>
 */
export function RecordingProvider({ children }: RecordingProviderProps): JSX.Element {
  const recording = useRecording();

  return (
    <RecordingContext.Provider value={recording}>
      {children}
    </RecordingContext.Provider>
  );
}

/**
 * useRecordingContext hook
 * 
 * Access recording context.
 * Must be used within RecordingProvider.
 * 
 * @throws {Error} If used outside RecordingProvider
 * 
 * @example
 * const { isRecording, steps, startRecording, stopRecording, addStep } = useRecordingContext();
 * 
 * // Start recording
 * await startRecording(projectId);
 * 
 * // Stop recording
 * await stopRecording();
 * 
 * // Add step manually
 * addStep({
 *   event: 'click',
 *   selector: '#button',
 *   label: 'Click Submit'
 * });
 */
export function useRecordingContext(): RecordingContextValue {
  const context = useContext(RecordingContext);
  
  if (!context) {
    throw new Error('useRecordingContext must be used within RecordingProvider');
  }
  
  return context;
}
