/**
 * Vitest Configuration
 * @module vitest.config
 * @version 1.0.0
 * 
 * Testing configuration for the Sammy Chrome Extension.
 * Uses jsdom for DOM testing, with mocks for Chrome APIs.
 */

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  
  test: {
    // Environment
    environment: 'jsdom',
    
    // Setup files
    setupFiles: ['./vitest.setup.ts'],
    
    // Global test APIs
    globals: true,
    
    // Include patterns
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'src/**/*.spec.ts',
      'src/**/*.spec.tsx',
      'tests/**/*.test.ts',
      'tests/**/*.test.tsx',
    ],
    
    // Exclude patterns
    exclude: [
      'node_modules',
      'dist',
      '.git',
      'coverage',
    ],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/**/*.spec.ts',
        'src/**/*.spec.tsx',
        'src/test/**',
        'src/**/*.d.ts',
        'src/main.tsx',
        'src/contentScript/content.ts',
        'src/background/background.ts',
      ],
      // Coverage thresholds by layer
      thresholds: {
        // Global thresholds
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
    },
    
    // Reporter
    reporters: ['verbose'],
    
    // Timeout
    testTimeout: 10000,
    hookTimeout: 10000,
    
    // Threads
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },
    
    // Mock clear/reset
    clearMocks: true,
    restoreMocks: true,
    
    // Snapshot
    snapshotFormat: {
      escapeString: true,
      printBasicPrototype: true,
    },
    
    // Type checking (optional, can be slow)
    typecheck: {
      enabled: false,
      include: ['**/*.test-d.ts'],
    },
  },
  
  // Path resolution (mirrors main vite.config.ts)
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@/core': resolve(__dirname, './src/core'),
      '@/components': resolve(__dirname, './src/components'),
      '@/hooks': resolve(__dirname, './src/hooks'),
      '@/context': resolve(__dirname, './src/context'),
      '@/pages': resolve(__dirname, './src/pages'),
      '@/test': resolve(__dirname, './src/test'),
    },
  },
});
