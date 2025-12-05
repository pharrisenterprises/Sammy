/**
 * Render Utilities
 * @module test/utils/render
 * @version 1.0.0
 * 
 * Custom render function with providers for React Testing Library.
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { MemoryRouter, MemoryRouterProps } from 'react-router-dom';
import { AppProvider } from '@/context';

// ============================================================================
// TYPES
// ============================================================================

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Initial route for MemoryRouter */
  route?: string;
  /** Initial routes array */
  initialEntries?: MemoryRouterProps['initialEntries'];
  /** Project ID for context */
  projectId?: string;
  /** Disable providers */
  withoutProviders?: boolean;
}

// ============================================================================
// ALL PROVIDERS WRAPPER
// ============================================================================

interface AllProvidersProps {
  children: React.ReactNode;
  route?: string;
  initialEntries?: MemoryRouterProps['initialEntries'];
  projectId?: string;
}

const AllProviders: React.FC<AllProvidersProps> = ({
  children,
  route = '/',
  initialEntries,
  projectId,
}) => {
  const entries = initialEntries || [route];

  return (
    <MemoryRouter initialEntries={entries}>
      <AppProvider projectId={projectId}>
        {children}
      </AppProvider>
    </MemoryRouter>
  );
};

// ============================================================================
// CUSTOM RENDER FUNCTION
// ============================================================================

/**
 * Custom render function with all providers
 */
function customRender(
  ui: ReactElement,
  options: CustomRenderOptions = {}
): RenderResult {
  const {
    route = '/',
    initialEntries,
    projectId,
    withoutProviders = false,
    ...renderOptions
  } = options;

  if (withoutProviders) {
    return render(ui, renderOptions);
  }

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <AllProviders
      route={route}
      initialEntries={initialEntries}
      projectId={projectId}
    >
      {children}
    </AllProviders>
  );

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

// ============================================================================
// COMPONENT-SPECIFIC RENDERS
// ============================================================================

/**
 * Render with router only
 */
function renderWithRouter(
  ui: ReactElement,
  options: { route?: string; initialEntries?: string[] } = {}
): RenderResult {
  const { route = '/', initialEntries = [route] } = options;

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <MemoryRouter initialEntries={initialEntries}>
      {children}
    </MemoryRouter>
  );

  return render(ui, { wrapper: Wrapper });
}

/**
 * Render with context only (no router)
 */
function renderWithContext(
  ui: ReactElement,
  options: { projectId?: string } = {}
): RenderResult {
  const { projectId } = options;

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <AppProvider projectId={projectId}>
      {children}
    </AppProvider>
  );

  return render(ui, { wrapper: Wrapper });
}

// ============================================================================
// EXPORTS
// ============================================================================

// Re-export everything from testing-library
export * from '@testing-library/react';

// Export custom render as default
export { customRender as render, renderWithRouter, renderWithContext };
