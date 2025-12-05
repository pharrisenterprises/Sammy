/**
 * StorageContext
 * 
 * Provides global access to projects and test runs data.
 * Combines useProjects and useTestRuns hooks.
 */

import React, { createContext, useContext, type ReactNode } from 'react';
import { useProjects, type UseProjectsReturn } from '@/hooks/useProjects';
import { useTestRuns, type UseTestRunsReturn } from '@/hooks/useTestRuns';

/**
 * Storage context value type
 */
export interface StorageContextValue {
  /**
   * Projects operations
   */
  projects: UseProjectsReturn;
  
  /**
   * Test runs operations
   */
  testRuns: UseTestRunsReturn;
}

/**
 * Storage context
 */
const StorageContext = createContext<StorageContextValue | null>(null);

/**
 * Storage context provider props
 */
export interface StorageProviderProps {
  children: ReactNode;
}

/**
 * StorageProvider component
 * 
 * Wraps children with storage context providing access to projects and test runs.
 * 
 * @example
 * <StorageProvider>
 *   <App />
 * </StorageProvider>
 */
export function StorageProvider({ children }: StorageProviderProps): JSX.Element {
  const projects = useProjects();
  const testRuns = useTestRuns();

  const value: StorageContextValue = {
    projects,
    testRuns
  };

  return (
    <StorageContext.Provider value={value}>
      {children}
    </StorageContext.Provider>
  );
}

/**
 * useStorageContext hook
 * 
 * Access storage context (projects and test runs).
 * Must be used within StorageProvider.
 * 
 * @throws {Error} If used outside StorageProvider
 * 
 * @example
 * const { projects, testRuns } = useStorageContext();
 * 
 * // Load all projects
 * useEffect(() => {
 *   projects.loadProjects();
 * }, []);
 * 
 * // Create project
 * await projects.createProject({ name: 'Test Project', url: 'https://example.com' });
 * 
 * // Get test runs
 * const runs = await testRuns.getTestRunsByProject(projectId);
 */
export function useStorageContext(): StorageContextValue {
  const context = useContext(StorageContext);
  
  if (!context) {
    throw new Error('useStorageContext must be used within StorageProvider');
  }
  
  return context;
}
