# BUILD PIPELINE OVERVIEW

## PURPOSE
This document describes how the Sammy browser automation extension is currently built, bundled, and packaged for distribution. It serves as a reference for understanding the build process and identifying optimization opportunities.

---

## BUILD SYSTEM

### Primary Build Tool: Vite
**Version**: 6.3.5

Vite is used as the primary build system for both the UI components and the background service worker. The project uses two separate Vite configurations to handle different build targets:

1. **Main Build** (`vite.config.ts`) - UI pages, popup, and frontend assets
2. **Background Build** (`vite.config.bg.ts`) - Background service worker

---

## BUILD CONFIGURATIONS

### 1. Main Build Configuration (vite.config.ts)

**Purpose**: Bundles all UI-facing components and pages

#### Entry Points
- `src/main.tsx` - Main React application entry
- `public/popup.html` - Extension popup interface
- `public/pages.html` - Standalone dashboard pages
- `public/index.html` - Main UI entry

#### Plugins
1. **@vitejs/plugin-react-swc** - Fast React refresh with SWC compiler
2. **@crxjs/vite-plugin** - Chrome extension build support (Manifest V3)
3. **vite-plugin-html** - Multi-page HTML generation and injection
4. **vite-plugin-static-copy** - Copies static assets to dist/

#### Output
- **Directory**: `dist/`
- **Format**: ES modules (ESM)
- **Code Splitting**: Automatic chunking by Vite
- **Source Maps**: Enabled for development, disabled for production

#### Build Command
```bash
npm run build
# Runs: vite build
```

#### Key Configuration Options
```typescript
{
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: './src/main.tsx',
        popup: './public/popup.html',
        pages: './public/pages.html'
      }
    }
  }
}
```

---

### 2. Background Build Configuration (vite.config.bg.ts)

**Purpose**: Bundles the background service worker separately

#### Entry Point
- `src/background/background.ts` - Service worker logic

#### Output
- **Directory**: `dist/`
- **Format**: ES module (required for Manifest V3 service workers)
- **Filename**: `background.js`

#### Build Command
```bash
npm run build:bg
# Runs: vite build --config vite.config.bg.ts
```

#### Key Configuration Options
```typescript
{
  build: {
    outDir: 'dist',
    lib: {
      entry: './src/background/background.ts',
      formats: ['es'],
      fileName: 'background'
    }
  }
}
```

---

## TYPESCRIPT COMPILATION

### Configurations
1. **tsconfig.json** - Main TypeScript configuration for src/
2. **tsconfig.node.json** - Node.js configuration for build scripts

### Compiler Options
```json
{
  "target": "ES2020",
  "module": "ESNext",
  "moduleResolution": "bundler",
  "jsx": "react-jsx",
  "strict": true,
  "esModuleInterop": true
}
```

### Type Checking
- **Build Time**: Type checking NOT enforced during Vite build (SWC skips it)
- **Development**: VS Code provides real-time type checking
- **CI/CD**: Should add `tsc --noEmit` for type validation

**Recommendation**: Add type checking step to build pipeline:
```bash
npm run type-check
# Should run: tsc --noEmit
```

---

## CSS & STYLING

### Tailwind CSS Processing
**Version**: 3.4.17

#### Configuration Files
- `tailwind.config.js` - Tailwind configuration (theme, plugins, purge)
- `postcss.config.js` - PostCSS with Tailwind and Autoprefixer

#### Processing Pipeline
```
CSS Source Files
  ↓
PostCSS (processes Tailwind directives)
  ↓
Autoprefixer (adds vendor prefixes)
  ↓
Vite (bundles and minifies)
  ↓
dist/assets/*.css
```

#### Tailwind Content Paths
```javascript
content: [
  "./src/**/*.{js,ts,jsx,tsx}",
  "./public/**/*.html"
]
```

#### Output
- Development: Unminified CSS with all utilities
- Production: Purged and minified CSS (unused utilities removed)

---

## ASSET HANDLING

### Static Asset Copy
**Plugin**: `vite-plugin-static-copy`

#### Copied Assets
- `public/manifest.json` → `dist/manifest.json`
- `public/icon/**` → `dist/icon/**`
- `public/fonts/**` → `dist/fonts/**`

### Dynamic Assets
- Images/icons imported in components → Hashed filenames in `dist/assets/`
- Fonts loaded via CSS → Copied to `dist/assets/`

---

## CONTENT SCRIPT BUNDLING

### Issue: Content Scripts NOT Bundled by Vite
Currently, content scripts are referenced in `manifest.json` but NOT built by Vite:

```json
"content_scripts": [
  {
    "matches": ["<all_urls>"],
    "js": ["src/contentScript/content.tsx"]
  }
]
```

**Problem**: Raw TypeScript files are referenced, which won't work in production.

### Solution: Add Content Script Build Step
**Recommended Approach**:

1. Create separate Vite config for content scripts:
```typescript
// vite.config.content.ts
export default defineConfig({
  build: {
    outDir: 'dist',
    lib: {
      entry: './src/contentScript/content.tsx',
      formats: ['iife'],
      fileName: 'content'
    }
  }
})
```

2. Update manifest.json:
```json
"content_scripts": [
  {
    "matches": ["<all_urls>"],
    "js": ["content.js"]
  }
]
```

3. Add build command:
```bash
npm run build:content
# Runs: vite build --config vite.config.content.ts
```

---

## POST-BUILD PROCESSING

### Post-Build Script
**File**: `scripts/postbuild.js`

#### Current Behavior
- Runs after main build completes
- Purpose: Inject or modify manifest.json dynamically

#### Execution
```json
"scripts": {
  "build": "vite build && node scripts/postbuild.js"
}
```

#### Typical Use Cases
- Add version from package.json to manifest.json
- Environment-specific manifest modifications
- Asset path corrections

---

## MANIFEST V3 REQUIREMENTS

### Service Worker
- **Type**: ES Module (`"type": "module"` in manifest)
- **File**: `background.js` (built from `background.ts`)
- **Bundling**: Must be self-contained, no dynamic imports

### Content Scripts
- **Format**: IIFE (Immediately Invoked Function Expression)
- **Isolation**: Runs in isolated world (separate from page context)
- **Dependencies**: All dependencies must be bundled inline

### Web Accessible Resources
```json
"web_accessible_resources": [
  {
    "resources": ["fonts/*", "icon/*"],
    "matches": ["<all_urls>"]
  }
]
```

---

## DEPENDENCY BUNDLING

### External Dependencies (NOT Bundled)
- Chrome APIs (`chrome.*`) - Provided by browser

### Bundled Dependencies
- React, React DOM, React Router - Bundled into main UI
- Redux Toolkit - Bundled into main UI
- Dexie.js - Bundled into background service worker
- PapaParse, XLSX - Bundled into UI
- All UI libraries (Radix, Tailwind, etc.) - Bundled into UI

### Code Splitting Strategy
Vite automatically splits code into chunks:
- Vendor chunk (node_modules)
- Component chunks (lazy-loaded routes)
- Common chunk (shared utilities)

**Current Issue**: No lazy loading implemented, all code loaded upfront.

**Recommendation**: Implement React lazy loading:
```typescript
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Recorder = lazy(() => import('./pages/Recorder'));
```

---

## BUILD MODES

### Development Mode
```bash
npm run dev
# Runs: vite (dev server with HMR)
```

**Features**:
- Hot Module Replacement (HMR)
- Source maps enabled
- Unminified code
- Fast rebuild times

**Port**: 5173 (default Vite port)

### Production Mode
```bash
npm run build
# Runs: vite build && node scripts/postbuild.js
```

**Features**:
- Minified and optimized code
- Tree shaking (dead code elimination)
- CSS purging (Tailwind unused utilities removed)
- Hashed filenames for cache busting

---

## OUTPUT STRUCTURE

### dist/ Directory After Build
```
dist/
├── manifest.json          (Chrome extension manifest)
├── background.js          (Service worker bundle)
├── popup.html            (Extension popup page)
├── pages.html            (Dashboard/UI pages)
├── index.html            (Main UI entry)
├── assets/
│   ├── main-[hash].js    (Main React app bundle)
│   ├── vendor-[hash].js  (Third-party dependencies)
│   ├── content-[hash].js (Content script - if built separately)
│   ├── styles-[hash].css (Compiled CSS)
│   └── [various assets]  (Images, fonts)
├── icon/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── fonts/
    └── [font files]
```

---

## ENVIRONMENT VARIABLES

### Vite Environment Variables
- `import.meta.env.MODE` - 'development' or 'production'
- `import.meta.env.DEV` - Boolean (true in dev mode)
- `import.meta.env.PROD` - Boolean (true in production)

### Custom Environment Variables
**Not currently configured** - Recommend adding `.env` support:

```
# .env.development
VITE_API_URL=http://localhost:3000

# .env.production
VITE_API_URL=https://api.example.com
```

---

## OPTIMIZATION OPPORTUNITIES

### 1. Bundle Size Reduction
**Current Issues**:
- Multiple UI libraries (Radix + Material-UI + Flowbite)
- Unused dependencies (Firebase, Axios, jQuery)

**Actions**:
- Remove unused dependencies
- Standardize on single UI library (Radix)
- Implement code splitting

### 2. Build Performance
**Current**:
- Two separate Vite builds (main + background)
- No parallel build execution

**Improvement**:
```bash
npm run build:all
# Run in parallel: npm-run-all -p build build:bg build:content
```

### 3. Type Checking
**Current**: No type checking in build pipeline

**Add**:
```json
"scripts": {
  "type-check": "tsc --noEmit",
  "build": "npm run type-check && vite build && node scripts/postbuild.js"
}
```

### 4. Linting
**Current**: ESLint configured but not run in build

**Add**:
```json
"scripts": {
  "lint": "eslint src/ --ext .ts,.tsx",
  "build": "npm run lint && npm run type-check && vite build"
}
```

### 5. Content Script Bundling
**Current**: Not bundled, raw TypeScript referenced

**Fix**: Create separate build config for content scripts (see earlier section)

---

## TESTING IN BUILD PIPELINE

### Current State
- No test scripts in package.json
- No test framework configured

### Recommended Testing Stack
1. **Unit Tests**: Jest + React Testing Library
2. **Integration Tests**: Playwright for extension testing
3. **Build Tests**: Smoke tests to verify dist/ output

**Add to package.json**:
```json
"scripts": {
  "test": "jest",
  "test:e2e": "playwright test",
  "test:build": "node scripts/verify-build.js"
}
```

---

## CI/CD CONSIDERATIONS

### GitHub Actions Workflow (Recommended)
```yaml
name: Build and Test
on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm test
      - run: npm run build
      - uses: actions/upload-artifact@v3
        with:
          name: extension-build
          path: dist/
```

### Release Workflow
1. Version bump in package.json
2. Update manifest.json version
3. Build production bundle
4. Create GitHub release
5. Upload dist/ as .zip for Chrome Web Store

---

## TROUBLESHOOTING

### Common Build Issues

#### Issue 1: TypeScript Errors
**Solution**: Run `tsc --noEmit` to check types before building

#### Issue 2: Missing Content Script in dist/
**Solution**: Add separate Vite config for content scripts

#### Issue 3: Large Bundle Size
**Solutions**:
- Run `npm run build -- --analyze` (if bundle analyzer added)
- Remove unused dependencies
- Implement code splitting

#### Issue 4: CSS Not Purged
**Solution**: Verify Tailwind content paths include all component files

#### Issue 5: Background Script Error
**Solution**: Check manifest.json has `"type": "module"` for background script

---

## NEXT STEPS

### Immediate Actions
1. ✅ Add content script build configuration
2. ✅ Add type checking to build pipeline
3. ✅ Add linting to build pipeline
4. ✅ Implement code splitting for UI

### Medium-Term Actions
1. Set up CI/CD pipeline (GitHub Actions)
2. Add automated testing
3. Optimize bundle size (remove unused deps)
4. Implement lazy loading for routes

### Long-Term Actions
1. Migrate to monorepo structure (if needed)
2. Add build performance monitoring
3. Implement progressive build optimization
4. Add automated release process
