/**
 * Module Verification Script
 * @module scripts/verify-modules
 * @version 1.0.0
 * 
 * Verifies that all modules are properly structured and exportable.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, '../src');

// ============================================================================
// CONFIGURATION
// ============================================================================

const REQUIRED_MODULES = {
  'core/types': {
    exports: ['Project', 'Step', 'TestRun', 'Field', 'LocatorBundle'],
    indexFile: true,
  },
  'core/storage': {
    exports: ['db', 'ProjectRepository', 'TestRunRepository', 'DexieStorageProvider'],
    indexFile: true,
  },
  'core/locators': {
    exports: ['LocatorResolver', 'StrategyRegistry', 'BundleBuilder'],
    indexFile: true,
  },
  'core/messages': {
    exports: ['MessageBus', 'MessageRouter', 'ChromeMessageAdapter'],
    indexFile: true,
  },
  'core/recording': {
    exports: ['RecordingEngine', 'EventListenerManager', 'LabelDetectionEngine'],
    indexFile: true,
  },
  'core/replay': {
    exports: ['ReplayEngine', 'ElementFinder', 'ActionExecutor'],
    indexFile: true,
  },
  'core/csv': {
    exports: ['CsvParser', 'AutoMapper', 'FuzzyMatcher'],
    indexFile: true,
  },
  'core/orchestrator': {
    exports: ['TestOrchestrator', 'ExecutionLoop', 'ProgressTracker'],
    indexFile: true,
  },
  'hooks': {
    exports: ['useProjects', 'useRecording', 'useReplay', 'useOrchestrator'],
    indexFile: true,
  },
  'context': {
    exports: ['AppProvider', 'StorageProvider', 'StorageContext'],
    indexFile: true,
  },
  'components': {
    exports: ['ErrorBoundary', 'LoadingSpinner', 'Button'],
    indexFile: true,
  },
  'pages': {
    exports: ['Dashboard', 'Recorder', 'FieldMapper', 'TestRunner'],
    indexFile: true,
  },
};

// ============================================================================
// VERIFICATION FUNCTIONS
// ============================================================================

function log(message, type = 'info') {
  const icons = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '❌',
  };
  console.log(`${icons[type]} ${message}`);
}

function checkModuleStructure(modulePath, config) {
  const fullPath = path.resolve(srcDir, modulePath);
  const results = {
    exists: false,
    hasIndex: false,
    exports: [],
    missing: [],
  };

  // Check directory exists
  if (!fs.existsSync(fullPath)) {
    return results;
  }
  results.exists = true;

  // Check index file
  const indexPath = path.resolve(fullPath, 'index.ts');
  if (fs.existsSync(indexPath)) {
    results.hasIndex = true;

    // Read and parse exports
    const content = fs.readFileSync(indexPath, 'utf-8');
    
    // Check for expected exports
    for (const exportName of config.exports) {
      if (
        content.includes(`export { ${exportName}`) ||
        content.includes(`export { default as ${exportName}`) ||
        content.includes(`export const ${exportName}`) ||
        content.includes(`export class ${exportName}`) ||
        content.includes(`export type { ${exportName}`) ||
        content.includes(`export function ${exportName}`) ||
        content.includes(`export * from`) // Broad check for re-exports
      ) {
        results.exports.push(exportName);
      } else {
        results.missing.push(exportName);
      }
    }
  }

  return results;
}

function verifyAllModules() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  Module Verification Report');
  console.log('='.repeat(60));
  console.log('');

  const report = {
    total: Object.keys(REQUIRED_MODULES).length,
    passed: 0,
    failed: 0,
    warnings: 0,
    details: [],
  };

  for (const [modulePath, config] of Object.entries(REQUIRED_MODULES)) {
    const results = checkModuleStructure(modulePath, config);
    
    console.log(`\n📦 ${modulePath}`);

    if (!results.exists) {
      log(`Directory not found: src/${modulePath}`, 'error');
      report.failed++;
      report.details.push({ module: modulePath, status: 'missing' });
      continue;
    }

    if (!results.hasIndex) {
      log(`Missing index.ts file`, 'warning');
      report.warnings++;
    } else {
      log(`Found index.ts`, 'success');
    }

    if (results.missing.length > 0) {
      log(`Missing exports: ${results.missing.join(', ')}`, 'warning');
      report.warnings++;
    }

    if (results.exports.length > 0) {
      log(`Found exports: ${results.exports.join(', ')}`, 'success');
    }

    if (results.exists && results.hasIndex && results.missing.length === 0) {
      report.passed++;
      report.details.push({ module: modulePath, status: 'passed' });
    } else if (results.exists) {
      report.details.push({ module: modulePath, status: 'partial', missing: results.missing });
    }
  }

  // Summary
  console.log('');
  console.log('='.repeat(60));
  console.log('  Summary');
  console.log('='.repeat(60));
  console.log('');
  
  log(`Total modules: ${report.total}`, 'info');
  log(`Passed: ${report.passed}`, report.passed === report.total ? 'success' : 'warning');
  log(`Failed: ${report.failed}`, report.failed === 0 ? 'success' : 'error');
  log(`Warnings: ${report.warnings}`, report.warnings === 0 ? 'success' : 'warning');
  
  console.log('');

  // Exit code
  if (report.failed > 0) {
    process.exit(1);
  }
}

// ============================================================================
// RUN
// ============================================================================

verifyAllModules();
