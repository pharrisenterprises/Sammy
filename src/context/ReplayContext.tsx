/**
 * ReplayContext
 * 
 * Provides global access to replay state and operations.
 * Wraps useReplay hook.
 */

import React, { createContext, useContext, type ReactNode } from 'react';
import { useReplay, type UseReplayReturn } from '@/hooks/useReplay';

/**
 * Replay context value type
 */
export type ReplayContextValue = UseReplayReturn;

/**
 * Replay context
 */
const ReplayContext = createContext<ReplayContextValue | null>(null);

/**
 * Replay context provider props
 */
export interface ReplayProviderProps {
  children: ReactNode;
}

/**
 * ReplayProvider component
 * 
 * Wraps children with replay context providing access to replay state.
 * 
 * @example
 * <ReplayProvider>
 *   <ReplayUI />
 * </ReplayProvider>
 */
export function ReplayProvider({ children }: ReplayProviderProps): JSX.Element {
  const replay = useReplay();

  return (
    <ReplayContext.Provider value={replay}>
      {children}
    </ReplayContext.Provider>
  );
}

/**
 * useReplayContext hook
 * 
 * Access replay context.
 * Must be used within ReplayProvider.
 * 
 * @throws {Error} If used outside ReplayProvider
 * 
 * @example
 * const { status, progress, results, startReplay, pauseReplay, resumeReplay } = useReplayContext();
 * 
 * // Start replay
 * await startReplay(projectId, steps);
 * 
 * // Pause during execution
 * pauseReplay();
 * 
 * // Resume execution
 * resumeReplay();
 * 
 * // Check results
 * if (status === 'completed') {
 *   console.log('Passed:', results.passed);
 *   console.log('Failed:', results.failed);
 * }
 */
export function useReplayContext(): ReplayContextValue {
  const context = useContext(ReplayContext);
  
  if (!context) {
    throw new Error('useReplayContext must be used within ReplayProvider');
  }
  
  return context;
}
