#!/usr/bin/env node

/**
 * Build Verification Script
 * 
 * Validates the build output to ensure all required files are present,
 * bundle sizes are within limits, and manifest is valid.
 * 
 * Exit codes:
 * - 0: Build is valid
 * - 1: Build has errors
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m',
};

let hasErrors = false;

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function error(message) {
  hasErrors = true;
  log(`✗ ${message}`, colors.red);
}

function warn(message) {
  log(`⚠ ${message}`, colors.yellow);
}

function success(message) {
  log(`✓ ${message}`, colors.green);
}

function info(message) {
  log(`  ${message}`, colors.blue);
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function getFileSize(filePath) {
  const stats = fs.statSync(filePath);
  return stats.size;
}

function formatSize(bytes) {
  return (bytes / 1024).toFixed(2) + ' KB';
}

function readJson(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    return null;
  }
}

// ============================================================================
// VERIFICATION CHECKS
// ============================================================================

function checkRequiredFiles() {
  log(`\n${colors.bold}Checking required files...${colors.reset}`);

  const requiredFiles = [
    'manifest.json',
    'index.html',
    'js/main.js',
    'background/background.js',
  ];

  let allPresent = true;

  for (const file of requiredFiles) {
    const filePath = path.join(distDir, file);
    if (fileExists(filePath)) {
      success(`${file} - ${formatSize(getFileSize(filePath))}`);
    } else {
      error(`${file} - MISSING`);
      allPresent = false;
    }
  }

  return allPresent;
}

function checkOptionalFiles() {
  log(`\n${colors.bold}Checking optional files...${colors.reset}`);

  const optionalFiles = [
    'js/interceptor.js',
    'js/replay.js',
    'pages.html',
    'popup.html',
  ];

  for (const file of optionalFiles) {
    const filePath = path.join(distDir, file);
    if (fileExists(filePath)) {
      info(`${file} - ${formatSize(getFileSize(filePath))}`);
    } else {
      warn(`${file} - Not present (optional)`);
    }
  }
}

function checkBundleSizes() {
  log(`\n${colors.bold}Checking bundle sizes...${colors.reset}`);

  const sizeChecks = [
    { path: 'js/main.js', limit: 2 * 1024 * 1024, name: 'Main bundle' },
    { path: 'background/background.js', limit: 500 * 1024, name: 'Background bundle' },
    { path: 'js/interceptor.js', limit: 100 * 1024, name: 'Interceptor bundle' },
    { path: 'js/replay.js', limit: 100 * 1024, name: 'Replay bundle' },
  ];

  for (const check of sizeChecks) {
    const filePath = path.join(distDir, check.path);
    if (!fileExists(filePath)) {
      continue; // Already reported in required/optional files check
    }

    const size = getFileSize(filePath);
    const limitFormatted = formatSize(check.limit);
    const sizeFormatted = formatSize(size);

    if (size > check.limit) {
      error(`${check.name} exceeds size limit: ${sizeFormatted} > ${limitFormatted}`);
    } else {
      const percentage = ((size / check.limit) * 100).toFixed(1);
      success(`${check.name}: ${sizeFormatted} (${percentage}% of ${limitFormatted} limit)`);
    }
  }
}

function checkManifest() {
  log(`\n${colors.bold}Checking manifest.json...${colors.reset}`);

  const manifestPath = path.join(distDir, 'manifest.json');
  if (!fileExists(manifestPath)) {
    error('manifest.json not found');
    return;
  }

  const manifest = readJson(manifestPath);
  if (!manifest) {
    error('manifest.json is not valid JSON');
    return;
  }

  // Check manifest version
  if (manifest.manifest_version !== 3) {
    error(`Manifest version should be 3, got ${manifest.manifest_version}`);
  } else {
    success('Manifest version: 3');
  }

  // Check required fields
  const requiredFields = ['name', 'version', 'description'];
  for (const field of requiredFields) {
    if (!manifest[field]) {
      error(`Missing required field: ${field}`);
    } else {
      info(`${field}: ${manifest[field]}`);
    }
  }

  // Check version format
  if (manifest.version && !/^\d+\.\d+\.\d+$/.test(manifest.version)) {
    warn(`Version format should be X.Y.Z, got ${manifest.version}`);
  }

  // Check background service worker
  if (!manifest.background?.service_worker) {
    error('Missing background.service_worker');
  } else {
    const serviceWorkerPath = path.join(distDir, manifest.background.service_worker);
    if (fileExists(serviceWorkerPath)) {
      success('Background service worker found');
    } else {
      error(`Background service worker not found: ${manifest.background.service_worker}`);
    }
  }

  // Check permissions
  if (manifest.permissions && manifest.permissions.length > 0) {
    info(`Permissions: ${manifest.permissions.join(', ')}`);
  }

  // Check content security policy
  if (manifest.content_security_policy) {
    success('Content security policy defined');
  }
}

function checkIcons() {
  log(`\n${colors.bold}Checking icons...${colors.reset}`);

  const iconSizes = ['16', '48', '128'];
  const iconDir = path.join(distDir, 'icon');

  if (!fs.existsSync(iconDir)) {
    warn('Icon directory not found');
    return;
  }

  for (const size of iconSizes) {
    const iconPath = path.join(iconDir, `icon${size}.png`);
    if (fileExists(iconPath)) {
      success(`icon${size}.png found`);
    } else {
      warn(`icon${size}.png not found`);
    }
  }
}

function checkSourceMaps() {
  log(`\n${colors.bold}Checking for source maps...${colors.reset}`);

  const jsDir = path.join(distDir, 'js');
  if (!fs.existsSync(jsDir)) {
    return;
  }

  const files = fs.readdirSync(jsDir);
  const sourceMaps = files.filter(f => f.endsWith('.map'));

  if (sourceMaps.length > 0) {
    warn(`Found ${sourceMaps.length} source map(s) in production build:`);
    sourceMaps.forEach(f => warn(`  - ${f}`));
    warn('Consider removing source maps for production releases');
  } else {
    success('No source maps in production build');
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

function main() {
  log(`\n${colors.bold}${colors.blue}========================================`);
  log('Build Verification');
  log(`========================================${colors.reset}\n`);

  // Check if dist directory exists
  if (!fs.existsSync(distDir)) {
    error('dist/ directory not found. Did you run the build?');
    process.exit(1);
  }

  info(`Build directory: ${distDir}\n`);

  // Run all checks
  checkRequiredFiles();
  checkOptionalFiles();
  checkBundleSizes();
  checkManifest();
  checkIcons();
  checkSourceMaps();

  // Final summary
  log(`\n${colors.bold}${colors.blue}========================================${colors.reset}`);
  
  if (hasErrors) {
    log(`\n${colors.bold}${colors.red}Build verification FAILED${colors.reset}`);
    log(`${colors.red}Please fix the errors above before deploying.${colors.reset}\n`);
    process.exit(1);
  } else {
    log(`\n${colors.bold}${colors.green}Build verification PASSED${colors.reset}`);
    log(`${colors.green}All checks passed successfully!${colors.reset}\n`);
    process.exit(0);
  }
}

main();
