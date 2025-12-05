/**
 * Main - Application Entry Point
 * @module main
 * @version 1.0.0
 * 
 * Entry point for the React application.
 * Renders the App component into the DOM.
 * 
 * This file is referenced by:
 * - vite.config.ts as the main entry point
 * - public/index.html, popup.html, pages.html
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Import global styles
import './index.css';

// ============================================================================
// ENVIRONMENT CHECK
// ============================================================================

/**
 * Check if running in extension context
 */
const isExtensionContext = (): boolean => {
  return typeof chrome !== 'undefined' && chrome.runtime?.id !== undefined;
};

/**
 * Log environment info in development
 */
if (import.meta.env.DEV) {
  console.log('🚀 Sammy Test Automation');
  console.log(`Mode: ${import.meta.env.MODE}`);
  console.log(`Extension context: ${isExtensionContext()}`);
}

// ============================================================================
// RENDER APPLICATION
// ============================================================================

/**
 * Get or create root element
 */
const getRootElement = (): HTMLElement => {
  let root = document.getElementById('root');
  
  if (!root) {
    root = document.createElement('div');
    root.id = 'root';
    document.body.appendChild(root);
  }
  
  return root;
};

/**
 * Initialize and render the application
 */
const init = (): void => {
  const rootElement = getRootElement();
  const root = ReactDOM.createRoot(rootElement);

  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// ============================================================================
// HOT MODULE REPLACEMENT
// ============================================================================

// Enable HMR in development
if (import.meta.hot) {
  import.meta.hot.accept();
}