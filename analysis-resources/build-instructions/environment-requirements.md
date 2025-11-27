# Environment Requirements

## 1. Purpose
Define software versions, tools, and configuration required to develop, build, test, and deploy the Sammy Chrome Extension test automation recorder.

## 2. Required Software

### Node.js and npm
- **Node.js:** v18.x or v20.x (Vite 6.x requires Node 18+)
- **npm:** v9.x or v10.x (included with Node.js)
- Check versions: `node -v` (should show v18.x or v20.x), `npm -v`

### Chrome Browser
- **Google Chrome:** v120+ (Manifest V3 support)
- **Chrome DevTools:** Built-in (for extension debugging)
- **Extensions Developer Mode:** Enable at chrome://extensions

### Code Editor (Optional but Recommended)
- **VS Code:** Latest version with extensions:
  - ESLint (dbaeumer.vscode-eslint)
  - Tailwind CSS IntelliSense (bradlc.vscode-tailwindcss)
  - TypeScript and JavaScript Language Features (built-in)

### Git
- **Git:** v2.30+ for version control
- Check version: `git --version`

## 3. Development Dependencies

### Installed via npm
All dependencies in package.json:
- **React 18.2.0** and **react-dom 18.2.0**
- **TypeScript 5.0.2**
- **Vite 6.3.5**
- **Tailwind CSS 3.4.17**
- **Dexie.js 4.0.11**
- **@types/chrome 0.0.263** (Chrome Extension API types)

Install all dependencies:
```bash
npm install
```

## 4. Build Configuration Files

### TypeScript
- `tsconfig.json`: TypeScript compiler options (target: ES2020, module: ESNext, jsx: react-jsx)
- `tsconfig.node.json`: Node.js environment config for Vite scripts

### Vite
- `vite.config.ts`: UI pages build configuration
- `vite.config.bg.ts`: Background script build configuration

### Tailwind CSS
- `tailwind.config.js`: Tailwind configuration (custom colors, fonts, plugins)
- `postcss.config.js`: PostCSS plugins (tailwindcss, autoprefixer)

### ESLint (Optional)
- `.eslintrc.json` (if present): Linting rules for TypeScript/React

## 5. Chrome Extension Setup

### Load Unpacked Extension
1. Build extension: `npm run build`
2. Open Chrome: chrome://extensions
3. Enable "Developer mode" (toggle top-right)
4. Click "Load unpacked"
5. Select `dist/` directory

### Manifest V3 Requirements
- **manifest.json** in public/ with:
  - `"manifest_version": 3`
  - `"background": { "service_worker": "js/background.js" }`
  - `"content_scripts": [{ "matches": ["<all_urls>"], "js": ["js/main.js"] }]`
  - Permissions: `"storage"`, `"activeTab"`, `"tabs"`, `"scripting"`

## 6. Optional Tools

### Testing (Planned)
- **Vitest:** Unit test runner (not yet implemented)
- **Puppeteer:** E2E testing (not yet implemented)

### Debugging
- **Chrome DevTools:** Inspect extension pages (right-click popup → Inspect)
- **Background Script Console:** chrome://extensions → "Inspect views: service worker"
- **Content Script Console:** Inspect web page → Console shows content script logs

### CI/CD (Planned)
- **GitHub Actions:** Automated build and release (not yet configured)

## 7. Environment Variables

Currently none required. Future Supabase integration may need:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 8. Common Issues

### "Node version too low"
- Solution: Install Node.js 18+ from https://nodejs.org

### "Module not found" after npm install
- Solution: Delete node_modules/ and package-lock.json, run `npm install` again

### "Extension failed to load"
- Solution: Check dist/manifest.json exists, check background.js and main.js present in dist/js/

### "TypeScript errors in VS Code"
- Solution: Run `npx tsc --noEmit` to check for errors, ensure tsconfig.json points to src/

## 9. Developer-Must-Know Notes

### Node Version Management
Use nvm (Node Version Manager) to switch Node versions:
```bash
nvm install 20
nvm use 20
```

### Clean Build
```bash
rm -rf dist/ node_modules/ package-lock.json
npm install
npm run build
```

### Hot Reload Not Supported
- Chrome extensions require full reload after code changes
- Use watch mode: `npm run watch:build`, then click reload button at chrome://extensions

### Debugging Background Script
- Background console: chrome://extensions → "service worker" link
- Background may terminate after 30s (Manifest V3); logs disappear

### Debugging Content Scripts
- Inspect web page where extension runs
- Console shows content script logs mixed with page logs
- Filter by "user messages" or search for extension-specific log prefixes
