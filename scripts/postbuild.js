/**
 * Post-Build Script
 * @module scripts/postbuild
 * @version 1.0.0
 * 
 * Runs after build to:
 * - Copy and process manifest.json
 * - Inject version from package.json
 * - Validate build output
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');

// ============================================================================
// HELPERS
// ============================================================================

function log(message) {
  console.log(`[postbuild] ${message}`);
}

function error(message) {
  console.error(`[postbuild] ERROR: ${message}`);
  process.exit(1);
}

function readJson(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    error(`Failed to read ${filePath}: ${err.message}`);
  }
}

function writeJson(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (err) {
    error(`Failed to write ${filePath}: ${err.message}`);
  }
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyFile(src, dest) {
  try {
    fs.copyFileSync(src, dest);
    log(`Copied ${path.basename(src)} to dist/`);
  } catch (err) {
    error(`Failed to copy ${src}: ${err.message}`);
  }
}

// ============================================================================
// MANIFEST PROCESSING
// ============================================================================

function processManifest() {
  const manifestSrc = path.resolve(rootDir, 'public', 'manifest.json');
  const manifestDest = path.resolve(distDir, 'manifest.json');
  const packageJson = readJson(path.resolve(rootDir, 'package.json'));
  
  // Read manifest
  const manifest = readJson(manifestSrc);
  
  // Inject version from package.json
  manifest.version = packageJson.version;
  
  // Write processed manifest
  writeJson(manifestDest, manifest);
  log(`Updated manifest.json with version ${packageJson.version}`);
}

// ============================================================================
// BUILD VALIDATION
// ============================================================================

function validateBuild() {
  const requiredFiles = [
    'manifest.json',
    'js/main.js',
    'js/background.js',
    'js/interceptor.js',
    'js/replay.js',
    'index.html',
  ];
  
  const missingFiles = [];
  
  for (const file of requiredFiles) {
    const filePath = path.resolve(distDir, file);
    if (!fs.existsSync(filePath)) {
      missingFiles.push(file);
    }
  }
  
  if (missingFiles.length > 0) {
    log(`Warning: Missing files in dist/: ${missingFiles.join(', ')}`);
  } else {
    log('All required files present in dist/');
  }
}

// ============================================================================
// STATIC ASSET COPY
// ============================================================================

function copyStaticAssets() {
  const publicDir = path.resolve(rootDir, 'public');
  
  // Copy icons
  const iconSrc = path.resolve(publicDir, 'icon');
  const iconDest = path.resolve(distDir, 'icon');
  if (fs.existsSync(iconSrc)) {
    ensureDir(iconDest);
    const icons = fs.readdirSync(iconSrc);
    icons.forEach(icon => {
      copyFile(path.resolve(iconSrc, icon), path.resolve(iconDest, icon));
    });
  }
  
  // Copy fonts
  const fontsSrc = path.resolve(publicDir, 'fonts');
  const fontsDest = path.resolve(distDir, 'fonts');
  if (fs.existsSync(fontsSrc)) {
    ensureDir(fontsDest);
    const fonts = fs.readdirSync(fontsSrc);
    fonts.forEach(font => {
      copyFile(path.resolve(fontsSrc, font), path.resolve(fontsDest, font));
    });
  }
}

// ============================================================================
// BUILD STATS
// ============================================================================

function printBuildStats() {
  const jsDir = path.resolve(distDir, 'js');
  
  if (fs.existsSync(jsDir)) {
    const files = fs.readdirSync(jsDir);
    log('Build output sizes:');
    
    files.forEach(file => {
      const filePath = path.resolve(jsDir, file);
      const stats = fs.statSync(filePath);
      const sizeKb = (stats.size / 1024).toFixed(2);
      console.log(`  ${file}: ${sizeKb} KB`);
    });
  }
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
  log('Starting post-build processing...');
  
  // Ensure dist exists
  if (!fs.existsSync(distDir)) {
    error('dist/ directory not found. Run build first.');
  }
  
  // Process manifest
  processManifest();
  
  // Copy static assets
  copyStaticAssets();
  
  // Validate build
  validateBuild();
  
  // Print stats
  printBuildStats();
  
  log('Post-build complete!');
}

main();
