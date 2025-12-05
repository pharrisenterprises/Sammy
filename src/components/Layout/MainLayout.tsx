/**
 * MainLayout - Application Layout Wrapper
 * @module components/Layout/MainLayout
 * @version 1.0.0
 * 
 * Provides consistent layout structure for all pages.
 */

import React from 'react';
import { Header } from './Header';

// ============================================================================
// TYPES
// ============================================================================

/**
 * MainLayout props
 */
export interface MainLayoutProps {
  /** Page content */
  children: React.ReactNode;
  /** Hide header */
  hideHeader?: boolean;
  /** Additional classes */
  className?: string;
}

// ============================================================================
// MAIN LAYOUT COMPONENT
// ============================================================================

/**
 * Main application layout
 */
export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  hideHeader = false,
  className = '',
}) => {
  return (
    <div className={`min-h-screen bg-gray-50 ${className}`}>
      {/* Header */}
      {!hideHeader && <Header />}
      
      {/* Main content */}
      <main className="pb-8">
        {children}
      </main>
      
      {/* Footer (optional) */}
      <footer className="py-4 text-center text-sm text-gray-500 border-t bg-white">
        <p>Sammy Test Automation v1.0.0</p>
      </footer>
    </div>
  );
};

export default MainLayout;
