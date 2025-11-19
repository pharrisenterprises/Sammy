# environment-requirements.md

## Purpose
Defines required development environment setup, tools, versions, and system dependencies for building and testing the Sammy browser automation extension.

## Inputs
- Operating system: Linux (Ubuntu 24.04.3 LTS in dev container), macOS, or Windows
- Node.js: Version 18.x or 20.x (LTS releases)
- Package manager: npm 9.x+ (comes with Node.js)

## Outputs
- Working development environment capable of running npm install, npm run build, npm run dev
- Chrome browser with extension developer mode enabled for testing
- VS Code (recommended) with TypeScript, ESLint, Tailwind CSS extensions

## Internal Architecture
- **Node.js Environment**: Required for npm package management, Vite build system, TypeScript compilation, development server
- **Command Line Tools**: git for version control, apt/dpkg for Linux package management, docker for dev container (optional)
- **Browser Requirements**: Chrome/Edge/Brave (Chromium-based) with Manifest V3 support (Chrome 88+)
- **Editor Setup**: VS Code with recommended extensions: ESLint, Prettier, Tailwind CSS IntelliSense, TypeScript and JavaScript Language Features

## Critical Dependencies
- **Runtime**: Node.js 18.x or 20.x, npm 9.x+
- **Build Tools**: Vite 6.3.5, TypeScript 5.0.2, SWC compiler
- **Browser**: Chrome 88+ or equivalent Chromium-based browser
- **System Libraries**: None required (pure JavaScript project)

## Hidden Assumptions
- Dev container uses Ubuntu 24.04.3 LTS - assumes Linux compatibility for all dependencies
- Node.js installed via official installer or nvm - assumes PATH configured correctly
- Chrome extension developer mode enabled - requires manual browser configuration
- npm ci used in CI/CD - assumes package-lock.json committed to repository
- VS Code extensions auto-installed from .vscode/extensions.json if present

## Stability Concerns
- **Node Version Drift**: Project built with Node 18/20 - may break with Node 22+ due to breaking changes
- **NPM Dependency Hell**: 70+ dependencies with potential version conflicts - package-lock.json critical
- **Browser Version**: Manifest V3 features may vary across Chrome versions - target Chrome 100+ for stability
- **Dev Container Dependency**: If using Docker, requires Docker Desktop running - not all developers use containers
- **Global vs Local**: Some tools (TypeScript, ESLint) might be globally installed - conflicts with project versions

## Edge Cases
- **Windows Path Issues**: Backslashes in paths may break shell scripts - use cross-platform path tools
- **Port Conflicts**: Vite dev server uses port 5173 - fails if port already in use
- **Memory Constraints**: Vite build may fail on systems with < 4GB RAM - increase Node.js heap size
- **Case-Sensitive Filesystems**: Linux/macOS case-sensitive, Windows not - import path mismatches cause errors on Linux
- **NPM Registry Access**: Requires internet connection during npm install - offline mode requires pre-downloaded cache
- **Chrome Profile**: Extension installed per Chrome profile - switching profiles loses test data

## Developer-Must-Know Notes
- Install Node.js from https://nodejs.org (use LTS version, currently 18.x or 20.x)
- Run npm install in project root to install all dependencies (creates node_modules/ directory)
- Enable Chrome developer mode: chrome://extensions → toggle Developer mode → Load unpacked → select dist/ folder
- Recommended VS Code extensions: esbenp.prettier-vscode, dbaeumer.vscode-eslint, bradlc.vscode-tailwindcss
- Dev container configuration in .devcontainer/ if using VS Code Remote Containers
- Environment variables: None required for basic development (optional: VITE_API_URL for backend integration)
- Build commands: npm run build (production), npm run dev (development server), npm run watch:build (auto-rebuild)
- Testing extension: Load dist/ folder as unpacked extension in Chrome after building
