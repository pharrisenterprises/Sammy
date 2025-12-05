/**
 * Vite Config - Page Context Scripts
 * 
 * Builds page-interceptor.ts and page-replay.ts as separate IIFE bundles.
 */

import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: {
        interceptor: resolve(__dirname, 'src/contentScript/page-interceptor.ts'),
        replay: resolve(__dirname, 'src/contentScript/page-replay.ts'),
      },
      formats: ['iife'],
      name: 'PageScript',
    },
    rollupOptions: {
      output: {
        entryFileNames: 'js/[name].js',
        inlineDynamicImports: false,
      },
    },
    minify: 'terser',
    sourcemap: false,
  },
});
