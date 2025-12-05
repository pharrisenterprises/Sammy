/**
 * AppContext
 * 
 * Combined context provider that wraps all app contexts.
 * Provides single component to wrap entire app.
 */

import React, { type ReactNode } from 'react';
import { StorageProvider } from './StorageContext';
import { RecordingProvider } from './RecordingContext';
import { ReplayProvider } from './ReplayContext';

/**
 * App context provider props
 */
export interface AppProviderProps {
  children: ReactNode;
}

/**
 * AppProvider component
 * 
 * Combines all context providers (Storage, Recording, Replay).
 * Wrap your app root with this component to provide all contexts.
 * 
 * @example
 * // In main.tsx or App.tsx
 * import { AppProvider } from '@/context';
 * 
 * function Root() {
 *   return (
 *     <AppProvider>
 *       <App />
 *     </AppProvider>
 *   );
 * }
 * 
 * // In any component
 * import { useStorageContext, useRecordingContext, useReplayContext } from '@/context';
 * 
 * function MyComponent() {
 *   const { projects } = useStorageContext();
 *   const { isRecording } = useRecordingContext();
 *   const { status } = useReplayContext();
 *   
 *   // Use context values...
 * }
 */
export function AppProvider({ children }: AppProviderProps): JSX.Element {
  return (
    <StorageProvider>
      <RecordingProvider>
        <ReplayProvider>
          {children}
        </ReplayProvider>
      </RecordingProvider>
    </StorageProvider>
  );
}
