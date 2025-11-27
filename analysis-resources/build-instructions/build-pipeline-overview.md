# Build Pipeline - Overview

## 1. Purpose
Vite-based build system compiling TypeScript React extension into Chrome-compatible bundled JavaScript, with dual configuration for UI pages (popup/dashboard) and background service worker, plus static asset copying and manifest processing.

## 2. Inputs
- src/ TypeScript/React source files (App.tsx, background.ts, content.tsx, etc.)
- public/ static assets (manifest.json, HTML templates, icons, fonts)
- vite.config.ts for UI pages (main, popup, pages entry points)
- vite.config.bg.ts for background script (separate bundle)
- tsconfig.json for TypeScript compilation
- tailwind.config.js for CSS processing

## 3. Outputs
- dist/ directory with:
  - js/main.js (UI pages bundle with React)
  - js/background.js (service worker bundle, no React)
  - js/interceptor.js, js/replay.js (content scripts)
  - css/main.css (Tailwind compiled styles)
  - manifest.json (copied from public/)
  - index.html, popup.html, pages.html (processed templates)
  - fonts/, icon/ directories

## 4. Internal Architecture
**vite.config.ts (56 lines):**
- Entry points: main.tsx, page-interceptor.tsx, replay.ts
- Output: js/[name].js with source maps
- Plugins: @vitejs/plugin-react-swc (fast React compilation), vite-plugin-html (multi-page HTML processing), vite-plugin-static-copy
- Build options: minify: "terser", keepNames: true (preserve function names for debugging)
- Tailwind CSS processing via PostCSS

**vite.config.bg.ts (separate background build):**
- Entry point: background.ts
- Output: js/background.js (no React dependencies)
- Prevents React from being bundled into service worker (reduces size by 500KB)

**package.json scripts:**
- `npm run build`: Runs `tsc && vite build --config vite.config.ts && vite build --config vite.config.bg.ts`
- `npm run postbuild`: Executes scripts/postbuild.js (copies manifest, creates release zip)
- `npm run watch:build`: Nodemon watches src/ for changes, auto-rebuilds on save

**scripts/postbuild.js:**
- Copies public/manifest.json to dist/
- Creates release/extension.zip for Chrome Web Store upload
- Validates manifest.json structure

## 5. Critical Dependencies
- **Vite 6.3.5:** Build tool and dev server
- **TypeScript 5.0.2:** Type checking and compilation
- **@vitejs/plugin-react-swc:** Fast React compilation using SWC instead of Babel
- **Tailwind CSS 3.4.17:** Utility-first CSS framework
- **PostCSS 8.5.3:** CSS processing for Tailwind
- **vite-plugin-html 3.2.2:** Multi-page HTML template processing
- **vite-plugin-static-copy 2.1.0:** Static asset copying

## 6. Hidden Assumptions
- Node.js version compatible with Vite 6.x (Node 18+ required)
- Chrome Manifest V3 structure (background: { service_worker })
- All source files in src/, no dynamic imports from outside
- manifest.json manually maintained in public/ (no auto-generation)

## 7. Stability Concerns
- Dual vite.config setup brittle: changes must be synchronized between vite.config.ts and vite.config.bg.ts
- No CI/CD integration (manual `npm run build` required)
- postbuild.js uses sync file operations (may fail on large extensions)
- No build size monitoring (bundle may exceed Chrome Web Store 128MB limit)

## 8. Edge Cases
- Large dependencies (e.g., adding TensorFlow.js) may exceed Chrome extension size limit
- Source maps enabled in production (exposes source code, ~2MB overhead)
- keepNames: true prevents aggressive minification (larger bundle)

## 9. Developer-Must-Know Notes
### Build Both Configs for Complete Extension
```bash
npm run build  # Runs both vite.config.ts and vite.config.bg.ts
# OR manually:
vite build --config vite.config.ts && vite build --config vite.config.bg.ts
```

### Watch Mode for Development
```bash
npm run watch:build  # Auto-rebuilds on file changes
# Load dist/ folder as unpacked extension in Chrome (chrome://extensions)
```

### Bundle Size Optimization
- Check bundle size: `ls -lh dist/js/`
- main.js should be <2MB, background.js <500KB
- Use vite-plugin-visualizer to analyze bundle composition

### Source Maps in Production
- Current config enables source maps (sourcemap: true)
- Disable for production: `sourcemap: false` in vite.config.ts

### Chrome Web Store Upload
- scripts/postbuild.js creates release/extension.zip
- Max size: 128MB (current extension ~5MB)
- Ensure manifest.json version incremented for each release
